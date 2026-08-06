// Precomputed extension-tower constants for the default (BN254) modulus: the Fp6 sextic
// non-residue and the full Fp6/Fp12 Frobenius coefficient tables, exactly as produced by
// deriveFp6Params(Fp2.defaultParams) / deriveFp12Params(Fp6.defaultParams). Hardcoded because
// the generic derivation brute-forces the non-residue and exponentiates for every coefficient,
// which costs close to a second at import time; a unit test re-runs the derivation and asserts
// it still matches every value below. Each entry is an [a, b] pair of Fp2 components.

const fp6NonResidue = [9n, 1n];

const fp6FrobeniusCoeffsB = [
  [0x1n, 0x0n],
  [
    0x2fb347984f7911f74c0bec3cf559b143b78cc310c2c3330c99e39557176f553dn,
    0x16c9e55061ebae204ba4cc8bd75a079432ae2a1d0b7c9dce1665d51c640fcba2n,
  ],
  [0x30644e72e131a0295e6dd9e7e0acccb0c28f069fbb966e3de4bd44e5607cfd48n, 0x0n],
  [
    0x856e078b755ef0abaff1c77959f25ac805ffd3d5d6942d37b746ee87bdcfb6dn,
    0x4f1de41b3d1766fa9f30e6dec26094f0fdf31bf98ff2631380cab2baaa586den,
  ],
  [0x59e26bcea0d48bacd4f263f1acdb5c4f5763473177fffffen, 0x0n],
  [
    0x28be74d4bb943f51699582b87809d9caf71614d4b0b71f3a62e913ee1dada9e4n,
    0x14a88ae0cb747b99c2b86abcbe01477a54f40eb4c3f6068dedae0bcec9c7aac7n,
  ],
];

const fp6FrobeniusCoeffsC = [
  [0x1n, 0x0n],
  [
    0x5b54f5e64eea80180f3c0b75a181e84d33365f7be94ec72848a1f55921ea762n,
    0x2c145edbe7fd8aee9f3a80b03b0b1c923685d2ea1bdec763c13b4711cd2b8126n,
  ],
  [0x59e26bcea0d48bacd4f263f1acdb5c4f5763473177fffffen, 0x0n],
  [
    0xbc58c6611c08dab19bee0f7b5b2444ee633094575b06bcb0e1a92bc3ccbf066n,
    0x23d5e999e1910a12feb0f6ef0cd21d04a44a9e08737f96e55fe3ed9d730c239fn,
  ],
  [0x30644e72e131a0295e6dd9e7e0acccb0c28f069fbb966e3de4bd44e5607cfd48n, 0x0n],
  [
    0x1ee972ae6a826a7d1d9da40771b6f589de1afb54342c724fa97bda050992657fn,
    0x10de546ff8d4ab51d2b513cdbb25772454326430418536d15721e37e70c255c9n,
  ],
];

const fp12FrobeniusCoeffsB = [
  [0x1n, 0x0n],
  [
    0x1284b71c2865a7dfe8b99fdd76e68b605c521e08292f2176d60b35dadcc9e470n,
    0x246996f3b4fae7e6a6327cfe12150b8e747992778eeec7e5ca5cf05f80f362acn,
  ],
  [0x30644e72e131a0295e6dd9e7e0acccb0c28f069fbb966e3de4bd44e5607cfd49n, 0x0n],
  [
    0x19dc81cfcc82e4bbefe9608cd0acaa90894cb38dbe55d24ae86f7d391ed4a67fn,
    0xabf8b60be77d7306cbeee33576139d7f03a5e397d439ec7694aa2bf4c0c101n,
  ],
  [0x30644e72e131a0295e6dd9e7e0acccb0c28f069fbb966e3de4bd44e5607cfd48n, 0x0n],
  [
    0x757cab3a41d3cdc072fc0af59c61f302cfa95859526b0d41264475e420ac20fn,
    0xca6b035381e35b618e9b79ba4e2606ca20b7dfd71573c93e85845e34c4a5b9cn,
  ],
  [0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd46n, 0x0n],
  [
    0x1ddf9756b8cbf849cf96a5d90a9accfd3b2f4c893f42a9166615563bfbb318d7n,
    0xbfab77f2c36b843121dc8b86f6c4ccf2307d819d98302a771c39bb757899a9bn,
  ],
  [0x59e26bcea0d48bacd4f263f1acdb5c4f5763473177fffffen, 0x0n],
  [
    0x1687cca314aebb6dc866e529b0d4adcd0e34b703aa1bf84253b10eddb9a856c8n,
    0x2fb855bcd54a22b6b18456d34c0b44c0187dc4add09d90a0c58be1eae3bc3c46n,
  ],
  [0x59e26bcea0d48bacd4f263f1acdb5c4f5763473177ffffffn, 0x0n],
  [
    0x290c83bf3d14634db120850727bb392d6a86d50bd34b19b929bc44b896723b38n,
    0x23bd9e3da9136a739f668e1adc9ef7f0f575ec93f71a8df953c846338c32a1abn,
  ],
];

module.exports = {
  fp6NonResidue,
  fp6FrobeniusCoeffsB,
  fp6FrobeniusCoeffsC,
  fp12FrobeniusCoeffsB,
};
