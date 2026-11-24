import Image from 'next/image';

export function Brand() {
  return <div className="brand">
    <Image className="brand-logo" src="/ghl-prime-logo.webp" alt="GHL Prime" width={144} height={48} priority />
  </div>;
}
