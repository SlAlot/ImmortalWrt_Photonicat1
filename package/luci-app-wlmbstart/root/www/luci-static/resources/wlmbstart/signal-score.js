'use strict';
'require baseclass';

const qualityBands = [[8.5,'优秀'],[7,'良好'],[5,'一般'],[3,'较弱'],[0,'很差']];
const round = value => Math.round(value * 10) / 10;
const clamp = value => Math.max(0, Math.min(10, value));
const measured = (value, low, high) => Number.isFinite(value) && value >= low && value <= high;
const width = value => Number.isFinite(value) && value > 0 && value <= 10000 ? value : null;
const hasBand = row => row.band != null && row.band !== '' && row.band !== '--' || !!row.bandCandidates?.length;
const isActive = row => row.active !== false && row.online !== false && row.connected !== false && !/^(inactive|offline|deactivated)$/i.test(row.state || '');

function radioQuality(row) {
    if (!measured(row?.rsrp, -160, -20) || !measured(row?.sinr, -40, 60)) return null;
    const power = clamp((row.rsrp + 120) * 10 / 45);
    const clarity = clamp((row.sinr + 5) * 10 / 35);
    const signal = power * .45 + clarity * .55;
    if (!measured(row.rsrq, -60, 3)) return signal;
    const quality = clamp((row.rsrq + 20) * 10 / 15);
    return signal * .85 + quality * .15;
}

function carrierInventory(rows) {
    const inventory = [], identities = new Map();
    for (const row of rows || []) {
        if (!row || row.stale === true || !isActive(row) || !['NR','LTE'].includes(row.rat)) continue;
        const channel = Number.isInteger(row.servingChannel) ? row.servingChannel : row.channel;
        if (!Number.isInteger(row.channel) && !(row.roleKnown === true && row.role === 'scc' && (hasBand(row) || width(row.dlBandwidthMHz)))) continue;
        if (!hasBand(row) && !Number.isInteger(channel)) continue;
        const center = row.channelType === 'center';
        const key = Number.isInteger(channel) && (center || Number.isInteger(row.pci))
            ? [row.rat,row.channelType || 'channel',center ? '' : row.pci,channel].join('|') : null;
        if (key && identities.has(key)) {
            const entry = identities.get(key);
            if (width(entry.dlBandwidthMHz) === null) entry.dlBandwidthMHz = row.dlBandwidthMHz;
            continue;
        }
        const entry = { ...row, channel };
        inventory.push(entry);
        if (key) identities.set(key,entry);
    }
    return inventory;
}

function reportedBand(row) {
    const band = row?.band || (row?.bandCandidates?.length === 1 ? row.bandCandidates[0] : '');
    if (typeof band !== 'string' || !/^[nb]\d{1,3}$/i.test(band)) return '';
    return (band[0].toLowerCase() === 'n' ? 'n' : 'B') + band.slice(1);
}

function carrierLabel(primary, carriers, confirmed) {
    const current = reportedBand(primary) || reportedBand(carriers.find(row =>
        row.rat === primary.rat && Number.isInteger(primary.channel) && row.channel === primary.channel &&
        (row.pci == null || primary.pci == null || row.pci === primary.pci)));
    if (!confirmed) return current;

    const groups = [primary.rat, primary.rat === 'NR' ? 'LTE' : 'NR'].flatMap(rat => {
        const rows = carriers.filter(row => row.rat === rat);
        if (!rows.every(row => row.roleKnown !== false && ['pcc','nsa','scc'].includes(row.role) && Number.isInteger(row.channel)))
            return [];
        const anchors = rows.filter(row => row.role === 'pcc' || row.role === 'nsa');
        if (anchors.length !== 1) return [];
        const anchor = anchors[0];
        if (rat === primary.rat && anchor.pci != null && primary.pci != null && anchor.pci !== primary.pci)
            return [];
        if (rows.length < 2) return [];
        const bands = [anchor, ...rows.filter(row => row !== anchor)].map(reportedBand).filter(Boolean);
        return [{rat, bands, count:rows.length}];
    });
    if (!groups.length) return current;

    const mixed = groups.some(group => group.rat !== primary.rat) ||
        /NSA|EN.?DC/i.test(primary.networkMode || '');
    const labels = groups.map(group =>
        [group.bands.join(' + '), (mixed ? group.rat + ' ' : '') + group.count + 'CC'].filter(Boolean).join(' · '));
    if (current && !groups.some(group => group.rat === primary.rat)) labels.unshift(current);
    return labels.join(' / ');
}

function fromRadio(radio, primary) {
    const unavailable = { value:null, label:'未知', level:0, bandwidth:null, carrierText:'' };
    if (!radio || radio.stale === true || !primary?.rat || primary.stale === true) return unavailable;
    const rsrpLevel = measured(primary.rsrp,-160,-20)
        ? [-120,-110,-100,-90,-80].filter(threshold => primary.rsrp >= threshold).length : 0;
    const mode = String(primary.networkMode || '').toUpperCase();
    const signal = radioQuality(primary);

    // 带宽只随载波信息展示，信号评分使用当前小区的测量值。
    const state = radio.carrierState || {};
    const inventory = carrierInventory(state.stale === true ? [] : radio.carriers), seen = new Set();
    const carriers = inventory.filter(row => {
        if ((/\bSA\b/.test(mode) && row.rat === 'LTE') ||
            (/LTE|4G/.test(mode) && !/5G|NSA|EN.?DC/.test(mode) && row.rat === 'NR')) return false;
        const key = Number.isInteger(row.channel)
            ? [row.rat,row.channel].join('|')
            : [row.rat,row.band || row.bandCandidates?.join('/')].join('|');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
    const widths = carriers.map(row => width(row.dlBandwidthMHz));
    const bandwidth = widths.length && widths.every(value => value !== null) ? widths.reduce((sum,value) => sum + value,0) : null;
    const confirmed = (state.status === 'reported' || state.inventoryComplete === true) &&
        state.stale !== true && !['error','pending'].includes(state.queryStatus);
    const carrierText = carrierLabel(primary, carriers, confirmed);
    if (signal === null) return { ...unavailable, level:rsrpLevel, bandwidth, carrierText };
    const value = round(signal);
    return { value, label:qualityBands.find(band => value >= band[0])[1], level:Math.ceil(value / 2), bandwidth, carrierText };
}

return baseclass.extend({ fromRadio });
