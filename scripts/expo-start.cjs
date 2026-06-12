const os = require('node:os');

process.env.EXPO_NO_DEPENDENCY_VALIDATION =
  process.env.EXPO_NO_DEPENDENCY_VALIDATION || '1';

function getLanIPv4() {
  const privateIPv4Pattern = /^(10\.|172\.(1[6-9]|2\d|3[0-1])\.|192\.168\.)/;
  const virtualAdapterPattern =
    /(bluetooth|docker|hyper-v|loopback|npcap|virtual|virtualbox|vmware|vethernet|wsl)/i;

  const candidates = Object.entries(os.networkInterfaces())
    .flatMap(([name, entries]) => (entries || []).map((entry) => ({ ...entry, name })))
    .filter(
      (entry) =>
        (entry.family === 'IPv4' || entry.family === 4) &&
        !entry.internal &&
        privateIPv4Pattern.test(entry.address),
    );

  candidates.sort((a, b) => scoreLanCandidate(b) - scoreLanCandidate(a));
  return candidates[0]?.address;

  function scoreLanCandidate(entry) {
    let score = 0;

    if (!virtualAdapterPattern.test(entry.name)) score += 100;
    if (/wi-?fi|wireless|ethernet/i.test(entry.name)) score += 40;
    if (entry.address.startsWith('192.168.')) score += 30;
    if (entry.address.startsWith('10.')) score += 20;

    return score;
  }
}

const args = process.argv.slice(2);
const isStart = args[0] === 'start';
const hasHostFlag = args.some((arg) => arg === '--host' || arg.startsWith('--host='));
const requestedTunnel =
  args.includes('--tunnel') ||
  args.includes('--host=tunnel') ||
  args.some((arg, index) => arg === '--host' && args[index + 1] === 'tunnel');
const requestedLocalhost =
  args.includes('--localhost') ||
  args.includes('--host=localhost') ||
  args.some((arg, index) => arg === '--host' && args[index + 1] === 'localhost');

if (isStart && !requestedTunnel && !requestedLocalhost) {
  if (!hasHostFlag) {
    process.argv.push('--host', 'lan');
  }

  const lanIPv4 = getLanIPv4();
  if (!process.env.REACT_NATIVE_PACKAGER_HOSTNAME && lanIPv4) {
    process.env.REACT_NATIVE_PACKAGER_HOSTNAME = lanIPv4;
    console.log(`[expo-start] Using LAN host ${lanIPv4}`);
  }
}

require('@expo/cli');
