import { paseo } from '@polkadot-api/descriptors';
import { createClient } from 'polkadot-api';
import { getWsProvider } from 'polkadot-api/ws-provider/web';
import { withPolkadotSdkCompat } from 'polkadot-api/polkadot-sdk-compat';
import {
  PolkadotRuntimeOriginCaller,
  XcmVersionedLocation,
  XcmVersionedAssets,
  XcmV3Junction,
  XcmV3Junctions,
  XcmV3WeightLimit,
  XcmV3MultiassetFungibility,
  XcmV3MultiassetAssetId,
} from '@polkadot-api/descriptors';
import { DispatchRawOrigin } from '@polkadot-api/descriptors';
import { Binary } from 'polkadot-api';
import { ss58Decode } from '@polkadot-labs/hdkd-helpers';

// Connect to the Paseo relay chain
const client = createClient(
  withPolkadotSdkCompat(getWsProvider('wss://paseo-rpc.dwellir.com')),
);

const paseoApi = client.getTypedApi(paseo);

const popParaID = 4001;
const userAddress = 'INSERT_USER_ADDRESS';
const userPublicKey = ss58Decode(userAddress)[0];
const idBeneficiary = Binary.fromBytes(userPublicKey);

// Define the origin caller
// This is a regular signed account owned by a user
let origin = PolkadotRuntimeOriginCaller.system(
  DispatchRawOrigin.Signed(userAddress),
);

// Define a transaction to transfer assets from Polkadot to Pop Network using a Reserve Transfer
const tx = paseoApi.tx.XcmPallet.limited_reserve_transfer_assets({
  dest: XcmVersionedLocation.V3({
    parents: 0,
    interior: XcmV3Junctions.X1(
      XcmV3Junction.Parachain(popParaID), // Destination is the Pop Network parachain
    ),
  }),
  beneficiary: XcmVersionedLocation.V3({
    parents: 0,
    interior: XcmV3Junctions.X1(
      XcmV3Junction.AccountId32({
        // Beneficiary address on Pop Network
        network: undefined,
        id: idBeneficiary,
      }),
    ),
  }),
  assets: XcmVersionedAssets.V3([
    {
      id: XcmV3MultiassetAssetId.Concrete({
        parents: 0,
        interior: XcmV3Junctions.Here(), // Native asset from the sender. In this case PAS
      }),
      fun: XcmV3MultiassetFungibility.Fungible(120000000000n), // Asset amount to transfer
    },
  ]),
  fee_asset_item: 0, // Asset used to pay transaction fees
  weight_limit: XcmV3WeightLimit.Unlimited(), // No weight limit on transaction
});

// Execute the dry run call to simulate the transaction
const dryRunResult = await paseoApi.apis.DryRunApi.dry_run_call(
  origin,
  tx.decodedCall,
);

// Extract the data from the dry run result
const {
  execution_result: executionResult,
  emitted_events: emmittedEvents,
  local_xcm: localXcm,
  forwarded_xcms: forwardedXcms,
} = dryRunResult.value;

// Extract the XCM generated by this call
const xcmsToPop = forwardedXcms.find(
  ([location, _]) =>
    location.type === 'V4' &&
    location.value.parents === 0 &&
    location.value.interior.type === 'X1' &&
    location.value.interior.value.type === 'Parachain' &&
    location.value.interior.value.value === popParaID, // Pop network's ParaID
);
const destination = xcmsToPop[0];
const remoteXcm = xcmsToPop[1][0];

// Print the results
const resultObject = {
  execution_result: executionResult,
  emitted_events: emmittedEvents,
  local_xcm: localXcm,
  destination: destination,
  remote_xcm: remoteXcm,
};

console.dir(resultObject, { depth: null });

client.destroy();
