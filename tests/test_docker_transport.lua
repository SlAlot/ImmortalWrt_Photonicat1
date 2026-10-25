-- Exercise the packaged library with deterministic socket fragmentation.
-- The adapter implements the nixio/LTN12 interfaces, not Docker decoding.
local json = require 'cjson'
local fixture, socket_closed, sent
local util = {urlencode=function(s) return s end}
luci = {util=util}
package.preload['luci.util'] = function() return util end
package.preload['nixio.util'] = function() return {} end
package.preload['nixio.fs'] = function() return {} end
package.preload['luci.jsonc'] = function() return {
    stringify=json.encode,
    parse=function(s) local ok,v=pcall(json.decode,s); return ok and v or nil end
} end
package.preload['luci.ltn12'] = function()
    return {
        source={string=function(s)
            return function() local value=s;s=nil;return value end
        end,cat=function(a,b)
            return function() local value,err=a();if value or err then return value,err end;return b() end
        end},
        sink={table=function(t) return function(chunk) if chunk then t[#t+1]=chunk end;return 1 end end},
        pump={all=function(source,sink)
            while true do local chunk,err=source();if err then return nil,err end;if not chunk then return 1 end;sink(chunk) end
        end}
    }
end
package.preload['nixio'] = function() return {socket=function()
    local h,b,r=0,0,1
    local s={}
    function s:connect() return not fixture.disconnect end
    function s:close() socket_closed=socket_closed+1 end
    function s:send(data)
        if fixture.send_failure then return 0 end
        sent=sent..data:sub(1,1);return 1
    end
    function s:writeall(data)
        if fixture.send_failure or (fixture.fail_body and #sent>0) then return nil end
        sent=sent..data;return #data
    end
    function s:linesource() return function(flush)
        if flush then return fixture.initial or '' end
        h=h+1;return fixture.headers[h]
    end end
    function s:blocksource() return function() b=b+1;return fixture.body[b] end end
    function s:recv(n)
        local wire=fixture.wire or ''
        if r>#wire then return nil end
        local value=wire:sub(r,r+math.min(n,2)-1);r=r+#value;return value
    end
    function s:recvall(n)
        local wire=fixture.wire or ''
        if r+n-1>#wire then return nil end
        local value=wire:sub(r,r+n-1);r=r+n;return value
    end
    return s
end} end
local docker = dofile(arg[1])
local function client(options)
    fixture=options or {}
    fixture.headers=fixture.headers or {'HTTP/1.1 200 OK','Content-Type: application/json',''}
    fixture.body=fixture.body or {}
    socket_closed=0;sent=''
    return docker.new({socket_path='/test/docker.sock'})
end
local function pieces(text)
    local result={};for i=1,#text,3 do result[#result+1]=text:sub(i,i+2) end;return result
end
local cases={}
function cases.json_fragments()
    local dk=client({initial='{"Docker',body={'RootDir":"/overlay/docker",','"NCPU":4}'}})
    local result=dk:info()
    assert(result.code==200 and result.body.DockerRootDir=='/overlay/docker' and result.body.NCPU==4)
end
function cases.chunked_json()
    local text='{"DockerRootDir":"/overlay/docker","NCPU":4}'
    local wire=string.format('%X\r\n%s\r\n%X\r\n%s\r\n0\r\n\r\n',11,text:sub(1,11),#text-11,text:sub(12))
    local dk=client({headers={'HTTP/1.1 200 OK','content-type: application/json; charset=utf-8','transfer-encoding: chunked',''},wire=wire})
    local result=dk:info()
    assert(result.code==200 and result.body.DockerRootDir=='/overlay/docker' and result.body.NCPU==4)
end
function cases.ndjson_fragments()
    local dk=client({body=pieces('{"status":"Pulling"}\n{"status":"Complete"}\n')})
    local result=dk.images:create({query={fromImage='local/test'}})
    assert(result.code==200 and #result.body==2 and result.body[2].status=='Complete')
end
function cases.daemon_unavailable()
    local dk=client({disconnect=true})
    local result=dk:_ping()
    assert(result.code==497 and result.body.message and socket_closed==1)
    assert(dk.containers:logs({name='missing'}).code==497)
end
function cases.failed_send()
    local result=client({send_failure=true}):info()
    assert(result.code==498 and result.body.message and socket_closed==1)
end
function cases.failed_body_write()
    local result=client({fail_body=true}).containers:create({body={Image='local/test'}})
    assert(result.code==498 and result.body.message and socket_closed==1)
end
function cases.progress_callback()
    local text='{"status":"Pulling"}\n{"status":"Complete"}\n'
    local observed={}
    local result=client({body=pieces(text)}).images:create({query={fromImage='local/test'}},function(response,source)
        response.body={}
        while true do
            local chunk=source();if not chunk then break end
            observed[#observed+1]=chunk;response.body[#response.body+1]=chunk
        end
    end)
    assert(table.concat(observed)==text and result.body[2].status=='Complete')
end
function cases.empty_response()
    local result=client({headers={}}):info()
    assert(result.code==499 and result.body.message and socket_closed==1)
end
function cases.complete_request_write()
    local dk=client({headers={'HTTP/1.1 201 Created','Content-Type: application/json',''},body={'{"Id":"test-id"}'}})
    local result=dk.containers:create({body={Image='local/test',Cmd={'/bin/sh'}}})
    assert(result.code==201 and result.body.Id=='test-id')
    local header,body=sent:match('^(.-)\r\n\r\n(.*)$')
    assert(header and tonumber(header:match('Content%-Length: (%d+)'))==#body)
    assert(json.decode(body).Image=='local/test')
end
function cases.invalid_json()
    local result=client({body={'{"broken"'}}):info()
    assert(result.code==555 and type(result.body)=='table' and result.body.message)
end
function cases.multiplexed_logs()
    local function frame(kind,text) return string.char(kind,0,0,0,0,0,0,#text)..text end
    local dk=client({headers={'HTTP/1.1 200 OK','Content-Type: application/vnd.docker.multiplexed-stream',''},body=pieces(frame(1,'out\n')..frame(2,'错误\n'))})
    local result=dk.containers:logs({name='test'})
    assert(result.code==200 and result.body=='stdout: out\nstderr: 错误\n')
end
function cases.tty_logs()
    local result=client({headers={'HTTP/1.1 200 OK','Content-Type: application/vnd.docker.raw-stream',''},body=pieces('  tty ready\n')}):logs({name='test'})
    assert(result.code==200 and result.body=='  tty ready\n')
end
function cases.truncated_logs()
    local result=client({headers={'HTTP/1.1 200 OK','Content-Type: application/vnd.docker.multiplexed-stream',''},body={'\1\0\0'}}):logs({name='test'})
    assert(result.code==555 and result.body.message)
end
assert(cases[arg[2]],'unknown test case')()
print(arg[2]..' OK')
