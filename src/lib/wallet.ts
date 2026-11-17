// Server-side coins. When the owner's switch is on, the server sends `welcome.wallet = true` and holds the real
// balance: this device just shows it. Free rewards are asked for from the server (earn), and every balance
// change comes back as a `wallet` message.
import { net } from './net';
import { coinLink, profile } from './profile';
import { toast } from './toast';

coinLink.earn = (kind, amount, key) => net.send({ t: 'earn', kind, amount, key });
coinLink.spend = (amount) => net.send({ t: 'spend', amount });

net.on((m) => {
  if (m.t === 'welcome') coinLink.on = !!m.wallet;
  else if (m.t === 'wallet') {
    coinLink.on = true;
    if (profile.get().coins !== m.coins) profile.set({ coins: m.coins });
    if (m.note) toast(m.note, 'error');
  }
});
