import { memo } from 'react';

interface AssetIconProps {
  faucetId: string;
  size?: 'small' | 'normal' | number;
}

const AssetIcon = ({ faucetId, size = 'normal' }: AssetIconProps) => {
  const iconSize = size === 'normal'
    ? 32
    : size === 'small'
    ? 24
    : typeof size === 'number'
    ? size
    : 32;
  return (
    <span
      className={`icon-any icon-${faucetId} inline-block`}
      style={{ width: iconSize, height: iconSize }}
    >
    </span>
  );
};

export default memo(AssetIcon);
