// SWRT: HTTP and Unix stream boundaries are independent of recv/send calls.
function send_all(sock, data) {
	let offset = 0;
	while (offset < length(data)) {
		let written = sock.send(substr(data, offset));
		if (!written || written < 0) {
			sock.close();
			die('Docker socket write failed');
		}
		offset += written;
	}
	return true;
}

function read_http_start(sock) {
	let buffer = '';
	while (index(buffer, '\r\n\r\n') < 0 && index(buffer, '\n\n') < 0) {
		if (length(buffer) >= 65536) return null;
		let ready = socket.poll(8000, [sock, socket.POLLIN]);
		if (!ready || !length(ready)) return null;
		let data = sock.recv(BLOCKSIZE);
		if (!data) return null;
		buffer += data;
	}
	return buffer;
}
