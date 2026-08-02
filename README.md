# alg-field

Algebraic fields (`Fp`, `Fp2`, `Fp6`, `Fp12`) over a configurable prime, defaulting to the
alt_bn128 (BN254) curve parameters used by Ethereum precompiles.

## Install

```
npm install @wa1one/alg-field
```

- **Current (scoped) package:** https://www.npmjs.com/package/@wa1one/alg-field
- **Legacy package** (`alg-field`, unscoped, no longer maintained under this account): https://www.npmjs.com/package/alg-field

## Usage

```js
const { Field, Fp2, Fp6, Fp12, Parameters } = require("@wa1one/alg-field");

const a = new Field(9n);
const b = new Field(2n);
a.multiply(b).eq(new Field(18n)); // true
```

## API

### `Parameters`

Static holder for the default field modulus and curve order.

- `Parameters.p` — the field modulus (`bigint`).
- `Parameters.n` — the curve order (`bigint`).

### `Field`

Base prime field element, `v mod p`.

- `new Field(v, p?)` — `v` is coerced to `bigint` if needed; `p` defaults to `Parameters.p`.
- `static _0`, `static _1` — the additive and multiplicative identities.
- `static NON_RESIDUE` — the quadratic non-residue used to build `Fp2`.
- `static _2_INV` — the inverse of `2` mod `Parameters.p`.
- `.add(o)` / `.subtract(o)` / `.multiply(o)` / `.divide(o)` — field arithmetic against another `Field`. `.multiply(o)` also accepts an `Fp2`, scaling both of its components and returning an `Fp2`.
- `.square()` / `.double()` / `.negate()` — shorthand arithmetic.
- `.inverse()` — the multiplicative inverse, via `BigInt.prototype.modInv`.
- `.exp(k)` — modular exponentiation by `k` (`bigint` or coercible).
- `.isZero()` — `true` if the value is `0`.
- `.eq(o)` — value equality.
- `.bytes()` — little-endian byte array of the value.
- `.toString()` — decimal string of the value.

### `Fp2`

Quadratic extension field, `a + b·u` where `u² = Field.NON_RESIDUE`.

- `new Fp2(a, b)` — `a`/`b` may be `Field` instances or raw values (wrapped with the default modulus).
- `static _0`, `static _1` — the additive and multiplicative identities.
- `static NON_RESIDUE` — the non-residue used to build `Fp6`.
- `static FROBENIUS_COEFFS_B` — Frobenius coefficient table, indexed by `power % 2`.
- `.add(o)` / `.subtract(o)` / `.multiply(o)` / `.divide(o)` — field arithmetic against another `Fp2`.
- `.square()` / `.double()` / `.negate()` — shorthand arithmetic.
- `.inverse()` — the multiplicative inverse.
- `.mulByNonResidue()` — multiplies by `Fp2.NON_RESIDUE`.
- `.frobeniusMap(power)` — applies the Frobenius endomorphism coefficient at `power % 2`.
- `.exp(k)` — modular exponentiation by `k` (`bigint` or coercible).
- `.isZero()` — `true` if both components are `0`.
- `.eq(o)` — component-wise equality; `false` for non-`Fp2` values.
- `.toString()` — `"a, b"`.

### `Fp6`

Cubic extension of `Fp2`, `a + b·v + c·v²`.

- `new Fp6(a, b, c)` — `a`/`b`/`c` are `Fp2` instances.
- `static _0`, `static _1` — the additive and multiplicative identities.
- `static NON_RESIDUE` — the non-residue used to build `Fp12`.
- `static FROBENIUS_COEFFS_B`, `static FROBENIUS_COEFFS_C` — Frobenius coefficient tables, indexed by `power % 6`.
- `.add(o)` / `.subtract(o)` / `.divide(o)` — field arithmetic against another `Fp6`.
- `.multiply(o)` — accepts another `Fp6`, or an `Fp2` scalar that's applied component-wise.
- `.square()` / `.double()` / `.negate()` — shorthand arithmetic.
- `.inverse()` — the multiplicative inverse.
- `.mulByNonResidue()` — multiplies by `Fp6.NON_RESIDUE` (rotates components).
- `.frobeniusMap(power)` — applies the Frobenius endomorphism at `power % 6`.
- `.exp(k)` — modular exponentiation by `k` (`bigint` or coercible).
- `.isZero()` — `true` if all three components are `0`.
- `.eq(o)` — component-wise equality; `false` for non-`Fp6` values.
- `.toString()` — `"[a, b, c]"`.

### `Fp12`

Quadratic extension of `Fp6`, `a + b·w`. Used as the pairing target group.

- `new Fp12(a, b)` — `a`/`b` are `Fp6` instances.
- `static _0`, `static _1` — the additive and multiplicative identities.
- `static FROBENIUS_COEFFS_B` — Frobenius coefficient table, indexed by `power % 12`.
- `.add(o)` / `.subtract(o)` / `.divide(o)` / `.multiply(o)` — field arithmetic against another `Fp12`.
- `.square()` / `.double()` / `.negate()` — shorthand arithmetic.
- `.inverse()` — the multiplicative inverse.
- `.mulBy024(ell0, ellVW, ellVV)` — sparse multiplication by an element of the form used in Miller-loop line evaluations; equivalent to a dense `.multiply()` by the corresponding sparse `Fp12`.
- `.frobeniusMap(power)` — applies the Frobenius endomorphism at `power % 12`.
- `.cyclotomicSquared()` — optimized squaring for elements of the cyclotomic subgroup (norm 1).
- `.cyclotomicExp(pow)` — exponentiation via repeated `cyclotomicSquared()`.
- `.unitaryInverse()` — conjugation (`a - b·w`); equals the field inverse for unitary (norm-1) elements.
- `.negExp(exp)` — `this.cyclotomicExp(exp).unitaryInverse()`.
- `.isZero()` — `true` if both components are `0`.
- `.eq(o)` — component-wise equality; `true` for `this === o`, `false` for non-`Fp12` values.
- `.toString()` — `"[[a] [b]]"`.

### `Field2`, `Field12`

Exported but **not functional**. These are an unfinished port of a different BigInteger-style
API (`bigInt.isInstance`, `.compareTo()`, `.shiftLeft()`, `.modPow()`, etc.) that was never wired
up to a real dependency — every method throws or returns a wrong result as shipped. Use `Fp2`/
`Fp12` above instead; `Field2`/`Field12` are kept only for backwards compatibility of the export
shape until they're rewritten or removed.

### BigInt extensions

Requiring this package patches `BigInt.prototype` with the helpers the field classes rely on:

- `.modInv(p)` — modular inverse; throws `RangeError` if none exists.
- `.toZn(p)` — reduces into `[0, p)`.
- `.mod(p)` — reduces into `[0, p)`, handling negative values.
- `.bitLength()` — bit length of a positive value.
- `.testBit(n)` — whether bit `n` is set.

## Development

### To run tests

```
npm test
```

### To lint

```
npm run lint
```

### To build

```
npm run build
```
