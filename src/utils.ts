import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { normalizeSuiAddress } from '@mysten/sui/utils';

export const suiClient = new SuiClient({ url: getFullnodeUrl('mainnet') });

export const isOwned = (owner: unknown) => {
  if (typeof owner !== 'object' || owner === null) return false;

  if ('AddressOwner' in owner) return true;

  return false;
};

export const isOwnedByAddress = (owner: unknown, address: string) => {
  if (typeof owner !== 'object' || owner === null) return false;

  if ('AddressOwner' in owner && typeof owner.AddressOwner === 'string')
    return normalizeSuiAddress(owner.AddressOwner) === address;

  return false;
};
