// Shared helpers with professional Lucide React icons
import {
  Smartphone, Laptop, Wallet, CreditCard, ShoppingBag, Key,
  BookOpen, Sparkles, Banknote, Package, Footprints, Clock,
  CheckCircle2, AlertCircle, ShieldAlert, Building2, User, Landmark,
  HelpCircle, Eye, ShieldCheck, ArrowUpRight, Archive
} from 'lucide-react';

export function statusBadge(status) {
  const map = {
    'Found':                    { cls: 'badge-green',   Icon: CheckCircle2 },
    'Reported':                 { cls: 'badge-gray',    Icon: Clock },
    'Matched':                  { cls: 'badge-blue',    Icon: Eye },
    'Under Verification':       { cls: 'badge-yellow',  Icon: Clock },
    'Escalated to Department':  { cls: 'badge-cyan',    Icon: ArrowUpRight },
    'With Department':          { cls: 'badge-purple',  Icon: Building2 },
    'Verified by Department':   { cls: 'badge-green',   Icon: ShieldCheck },
    'At Admin Office':          { cls: 'badge-red',     Icon: Landmark },
    'Recovered':                { cls: 'badge-green',   Icon: CheckCircle2 },
    'Closed':                   { cls: 'badge-gray',    Icon: Archive },
  };

  const item = map[status] || { cls: 'badge-gray', Icon: HelpCircle };
  const Icon = item.Icon;

  return (
    <span className={`badge ${item.cls}`}>
      <Icon size={12} strokeWidth={2.2} style={{ marginRight: 4 }} />
      {status}
    </span>
  );
}

export function escalationBadge(level) {
  const map = {
    user:       { label: 'User Level',   cls: 'badge-gray',   Icon: User },
    department: { label: 'Department',   cls: 'badge-cyan',   Icon: Building2 },
    admin:      { label: 'Admin Office', cls: 'badge-red',    Icon: Landmark },
  };
  const m = map[level] || { label: level || 'None', cls: 'badge-gray', Icon: HelpCircle };
  const Icon = m.Icon;

  return (
    <span className={`badge ${m.cls}`}>
      <Icon size={12} strokeWidth={2.2} style={{ marginRight: 4 }} />
      {m.label}
    </span>
  );
}

export function valuableBadge(isValuable) {
  if (!isValuable) return null;
  return (
    <span className="badge badge-yellow">
      <Sparkles size={12} strokeWidth={2.2} style={{ marginRight: 4 }} />
      Valuable
    </span>
  );
}

export function formatDate(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

export function timeAgo(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60)   return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function CategoryIcon({ category, size = 16, className = '', style = {} }) {
  const key = (category || '').toLowerCase().replace(/\s+/g, '_');
  
  switch (key) {
    case 'mobile':
    case 'phone':
      return <Smartphone size={size} className={className} style={style} />;
    case 'electronics':
    case 'laptop':
      return <Laptop size={size} className={className} style={style} />;
    case 'wallets':
    case 'wallet':
    case 'purse':
      return <Wallet size={size} className={className} style={style} />;
    case 'id_cards':
    case 'id':
    case 'id_card':
      return <CreditCard size={size} className={className} style={style} />;
    case 'bags':
    case 'bag':
    case 'backpack':
      return <ShoppingBag size={size} className={className} style={style} />;
    case 'keys':
    case 'key':
      return <Key size={size} className={className} style={style} />;
    case 'books':
    case 'book':
    case 'notebook':
      return <BookOpen size={size} className={className} style={style} />;
    case 'jewelry':
    case 'jewel':
    case 'gold':
      return <Sparkles size={size} className={className} style={style} />;
    case 'cash':
    case 'money':
      return <Banknote size={size} className={className} style={style} />;
    case 'shoes':
    case 'shoe':
    case 'footwear':
      return <Footprints size={size} className={className} style={style} />;
    default:
      return <Package size={size} className={className} style={style} />;
  }
}

export function categoryIcon(cat) {
  return <CategoryIcon category={cat} size={15} />;
}
