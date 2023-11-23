import type { OutputInstance } from '@bitcoinerlab/descriptors';
import { DUST_RELAY_FEE_RATE, OutputWithValue } from '../index';
import {
  validateFeeRate,
  validateOutputWithValues,
  validatedFeeAndVsize
} from '../validation';
import { vsize } from '../vsize';
import { isDust } from '../dust';

/**
 * The `maxFunds` algorithm is tailored for scenarios where the goal is to transfer all funds from specified UTXOs to a single recipient output.
 * To utilize this function, specify the recipient output in the `remainder` argument, while omitting the `targets` parameter.
 * In this context, the `remainder` serves as the recipient of the funds.
 *
 * Note: This function does not reorder UTXOs prior to selection.
 *
 * Refer to {@link coinselect coinselect} for additional details on input parameters and expected returned values.
 */
export function maxFunds({
  utxos,
  remainder,
  feeRate,
  dustRelayFeeRate = DUST_RELAY_FEE_RATE
}: {
  utxos: Array<OutputWithValue>;
  /**
   * Recipient to send maxFunds
   */
  remainder: OutputInstance;
  feeRate: number;
  dustRelayFeeRate?: number;
}) {
  validateOutputWithValues(utxos);
  validateFeeRate(feeRate);
  validateFeeRate(dustRelayFeeRate);

  const allUtxosFee = Math.ceil(
    feeRate *
      vsize(
        utxos.map(utxo => utxo.output),
        [remainder]
      )
  );

  // Only consider inputs with more value than the fee they require
  const validUtxos = utxos.filter(validUtxo => {
    const txSizeWithoutUtxo = vsize(
      utxos.filter(utxo => utxo !== validUtxo).map(utxo => utxo.output),
      [remainder]
    );
    const feeContribution =
      allUtxosFee - Math.ceil(feeRate * txSizeWithoutUtxo);
    if (feeContribution < 0) throw new Error(`feeContribution < 0`);
    return validUtxo.value > feeContribution;
  });

  const validFee = Math.ceil(
    feeRate *
      vsize(
        validUtxos.map(utxo => utxo.output),
        [remainder]
      )
  );
  const validUtxosValue = validUtxos.reduce((a, utxo) => a + utxo.value, 0);
  const remainderValue = validUtxosValue - validFee;
  if (!isDust(remainder, remainderValue, dustRelayFeeRate)) {
    //return the same reference if nothing changed to interact nicely with
    //reactive components
    const targets = [{ output: remainder, value: remainderValue }];
    return {
      utxos: utxos.length === validUtxos.length ? utxos : validUtxos,
      targets,
      ...validatedFeeAndVsize(validUtxos, targets, feeRate)
    };
  } else return;
}
