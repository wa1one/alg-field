# alg-field

Algebraic fields (`Fp`, `Fp2`, `Fp6`, `Fp12`) over a configurable prime, defaulting to the
alt_bn128 (BN254) curve parameters used by Ethereum precompiles.

No curve-specific constant is baked into the algorithms: every non-residue and Frobenius
coefficient table is *derived* from the modulus, so the `Fp2`/`Fp6`/`Fp12` tower works for any
prime — not just BN254's. (The BN254 defaults themselves ship precomputed so importing the
package stays fast; a unit test re-runs the derivation and asserts it reproduces them exactly.)
See [Tunable curve parameters](#tunable-curve-parameters).

## Install

```
npm install alg-field
```

- **Package:** https://www.npmjs.com/package/alg-field
- **Scoped mirror:** https://www.npmjs.com/package/@wa1one/alg-field

## Usage

```js
const { Field, Fp2, Fp6, Fp12, Parameters } = require("alg-field");

const a = new Field(9n);
const b = new Field(2n);
a.multiply(b).eq(new Field(18n)); // true
```

## API

### `Parameters`

Static holder for the default field modulus and curve order (BN254/alt_bn128).

- `Parameters.p` — the field modulus (`bigint`).
- `Parameters.n` — the curve order (`bigint`).

### `Bls12381Parameters`

Same shape as `Parameters`, but for BLS12-381 — see
[Using with BLS12-381](#using-with-bls12-381).

- `Bls12381Parameters.p` — the field modulus (`bigint`).
- `Bls12381Parameters.n` — the curve order (`bigint`).

### `Field`

Base prime field element, `v mod p`.

- `new Field(v, p?)` — `v` is coerced to `bigint` if needed; `p` defaults to `Parameters.p`.
  `Field` itself needs no other curve parameters — non-residues/Frobenius tables only come in
  at the `Fp2` level and above.
- `static _0`, `static _1` — the additive and multiplicative identities.
- `static NON_RESIDUE` — the quadratic non-residue used to build `Fp2` for `Parameters.p`
  (derived at load time via `findQuadraticNonResidue`, not hardcoded).
- `static _2_INV` — the inverse of `2` mod `Parameters.p`.
- `.add(o)` / `.subtract(o)` / `.multiply(o)` / `.divide(o)` — field arithmetic against another `Field`, a raw `bigint`/`number`, or any higher tower level (see [Mixing tower levels](#mixing-tower-levels)).
- `.square()` / `.double()` / `.negate()` — shorthand arithmetic.
- `.inverse()` — the multiplicative inverse, via `BigInt.prototype.modInv`.
- `.exp(k)` — modular exponentiation by `k` (`bigint` or coercible).
- `.isZero()` — `true` if the value is `0`.
- `.eq(o)` — value equality.
- `.bytes()` — little-endian byte array of the value.
- `.toString()` — decimal string of the value.

### `Fp2`

Quadratic extension field, `a + b·u` where `u²` is this instance's own non-residue (its
`params.nonResidue`).

- `new Fp2(a, b, params?)` — `a`/`b` may be `Field` instances or raw values (wrapped with
  `params.p`). `params` defaults to `Fp2.defaultParams` (BN254); build your own with
  [`deriveFp2Params`](#tunable-curve-parameters) for a different modulus. Every method that
  returns a new `Fp2` (`add`, `multiply`, `frobeniusMap`, ...) carries the same `params`
  forward, so a tower built on a custom prime stays self-consistent through chained calls.
- `static one(params?)` / `static zero(params?)` — the multiplicative/additive identity for a
  given `params` (defaults to `Fp2.defaultParams`).
- `static _0`, `static _1` — shorthand for `Fp2.zero()`/`Fp2.one()` with the default params.
- `static NON_RESIDUE` — **the `Fp6`-level non-residue** (`9 + u` for BN254), not this class's
  own `u²`; kept under this name only for backward compatibility with `.mulByNonResidue()`
  below. For an instance's own construction non-residue use `instance.params.nonResidue`.
- `static FROBENIUS_COEFFS_B` — the default (BN254) Frobenius coefficient table, indexed by
  `power % 2`; a custom-params instance uses `instance.params.frobeniusCoeffsB` instead.
- `.add(o)` / `.subtract(o)` / `.multiply(o)` / `.divide(o)` — field arithmetic against another `Fp2`, a `Field`/`bigint`/`number` scalar, or a higher level (see [Mixing tower levels](#mixing-tower-levels)).
- `.square()` / `.double()` / `.negate()` — shorthand arithmetic.
- `.inverse()` — the multiplicative inverse.
- `.mulByNonResidue()` — multiplies by the default `Fp6`-level non-residue (`Fp2.NON_RESIDUE`);
  a fixed BN254 convenience, not itself tunable — see `Fp6`'s own methods for the tunable path.
- `.frobeniusMap(power)` — applies this instance's own Frobenius coefficient at `power % 2`.
- `.exp(k)` — modular exponentiation by `k` (`bigint` or coercible).
- `.isZero()` — `true` if both components are `0`.
- `.eq(o)` — component-wise equality; `false` for non-`Fp2` values.
- `.toString()` — `"a, b"`.

### `Fp6`

Cubic extension of `Fp2`, `a + b·v + c·v²` where `v³` is this instance's own non-residue.

- `new Fp6(a, b, c, params?)` — `a`/`b`/`c` are `Fp2` instances (built with matching `Fp2`
  params). `params` defaults to `Fp6.defaultParams` (BN254); build your own with
  [`deriveFp6Params`](#tunable-curve-parameters). Carried forward automatically through every
  method that returns a new `Fp6`.
- `static one(params?)` / `static zero(params?)` — the multiplicative/additive identity for a
  given `params` (defaults to `Fp6.defaultParams`).
- `static _0`, `static _1` — shorthand for `Fp6.zero()`/`Fp6.one()` with the default params.
- `static NON_RESIDUE` — the default (BN254) non-residue used to build `Fp12`; a custom-params
  instance uses `instance.params.nonResidue` instead (used internally by all of `Fp6`'s own
  methods, so a custom-curve `Fp6` behaves correctly without touching this static).
- `static FROBENIUS_COEFFS_B`, `static FROBENIUS_COEFFS_C` — the default Frobenius coefficient
  tables, indexed by `power % 6`; a custom-params instance uses `instance.params.frobeniusCoeffsB`/`frobeniusCoeffsC`.
- `.add(o)` / `.subtract(o)` / `.multiply(o)` / `.divide(o)` — field arithmetic against another `Fp6`, or an `Fp2`/`Field`/`bigint`/`number` scalar applied component-wise (see [Mixing tower levels](#mixing-tower-levels)).
- `.square()` / `.double()` / `.negate()` — shorthand arithmetic.
- `.inverse()` — the multiplicative inverse.
- `.mulByNonResidue()` — multiplies by this instance's own non-residue (rotates components);
  tunable, unlike `Fp2`'s same-named method.
- `.frobeniusMap(power)` — applies this instance's own Frobenius coefficients at `power % 6`.
- `.exp(k)` — modular exponentiation by `k` (`bigint` or coercible).
- `.isZero()` — `true` if all three components are `0`.
- `.eq(o)` — component-wise equality; `false` for non-`Fp6` values.
- `.toString()` — `"[a, b, c]"`.

### `Fp12`

Quadratic extension of `Fp6`, `a + b·w`. Used as the pairing target group.

- `new Fp12(a, b, params?)` — `a`/`b` are `Fp6` instances (built with matching `Fp6` params).
  `params` defaults to `Fp12.defaultParams` (BN254); build your own with
  [`deriveFp12Params`](#tunable-curve-parameters). `Fp12` reuses `a`/`b`'s own `Fp6`
  non-residue internally (via their `.mulByNonResidue()`/`.params`), so it needs no
  non-residue of its own.
- `static one(params?)` / `static zero(params?)` — the multiplicative/additive identity for a
  given `params` (defaults to `Fp12.defaultParams`).
- `static _0`, `static _1` — shorthand for `Fp12.zero()`/`Fp12.one()` with the default params.
- `static FROBENIUS_COEFFS_B` — the default Frobenius coefficient table, indexed by
  `power % 12`; a custom-params instance uses `instance.params.frobeniusCoeffsB`.
- `.add(o)` / `.subtract(o)` / `.divide(o)` / `.multiply(o)` — field arithmetic against another `Fp12`, or an `Fp6`/`Fp2`/`Field`/`bigint`/`number` scalar applied component-wise (see [Mixing tower levels](#mixing-tower-levels)).
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

## Mixing tower levels

`Field` ⊂ `Fp2` ⊂ `Fp6` ⊂ `Fp12` is a tower, and arithmetic works across it: `add`,
`subtract`, `multiply`, and `divide` each accept **their own type, any level below it, or a
raw `bigint`/`number` scalar**. The result of mixing two levels always lives at the higher of
the two, so a lower-level receiver lifts itself before operating.

```js
const k = new Field(3n);
const f2 = new Fp2(5n, 7n);
const f12 = Fp12._1;

f2.multiply(k); // Fp2 — scales both components
f2.multiply(3n); // same, from a raw scalar
f12.add(2n); // Fp12
k.multiply(f2); // Fp2 — commutes with f2.multiply(k)
k.subtract(f2); // Fp2 — k is lifted, so this is -(f2 - k)
```

Embedding is not an approximation: multiplying by a scalar embedded as `(k, 0, …)` is exactly
the component-wise scaling the fast paths perform, which the test suite asserts directly.

An operand that can't be interpreted throws `Incorrect type argument` naming the expected type.
`Field2`/`Field12` follow the same rule for the scalars they accept (`bigint`, `number`, or a
`Field`), alongside `Field2` operands.

## Tunable curve parameters

`Field`, `Fp2`, `Fp6`, and `Fp12` all default to BN254 (`Parameters.p`), but every non-residue
and Frobenius coefficient table above is derived from the modulus rather than hardcoded, so the
same classes work for **any prime**. The `Fp2` non-residue is whatever
`findQuadraticNonResidue` picks for that modulus (`-1` when `p ≡ 3 (mod 4)`, otherwise the
smallest non-residue at or above `2`), so there is no `p ≡ 3 (mod 4)` requirement here — that
constraint applies only to [`Field2`](#field2)/[`Field12`](#field12), which fix `u² = -1`.

```js
const {
  Field,
  Fp2,
  Fp6,
  Fp12,
  deriveFp2Params,
  deriveFp6Params,
  deriveFp12Params,
} = require("alg-field");

const p = 10007n; // any prime

const fp2Params = deriveFp2Params(p);
const fp6Params = deriveFp6Params(fp2Params);
const fp12Params = deriveFp12Params(fp6Params);

const a = new Fp2(3n, 5n, fp2Params);
const b = new Fp2(7n, 2n, fp2Params);
a.multiply(b).eq(b.multiply(a)); // true, on the p = 10007 curve

const one = Fp12.one(fp12Params);
```

- `deriveFp2Params(p, nonResidueOverride?)` — returns `{ p, nonResidue, frobeniusCoeffsB }`.
  Picks `-1` as the non-residue when `p ≡ 3 (mod 4)`, otherwise searches upward from `2`;
  pass a `Field` as `nonResidueOverride` to pick one yourself instead.
- `deriveFp6Params(fp2Params, nonResidueOverride?)` — returns
  `{ p, nonResidue, frobeniusCoeffsB, frobeniusCoeffsC }`. Searches `Fp2` elements (in
  `(re, im)` order) for the first that's neither a square nor a cube; pass an `Fp2` as
  `nonResidueOverride` to pick one yourself. For `Parameters.p` this reproduces the canonical
  `9 + u` exactly.
- `deriveFp12Params(fp6Params)` — returns `{ p, frobeniusCoeffsB, fp6Params }`.
- `deriveField12ModulusCoeffs(fp6Params)` — returns the 12 `bigint` coefficients of
  [`Field12`](#field12)'s degree-12 modulus polynomial for that tower. `Field12` calls this
  itself when needed, so you only need it to inspect or override the choice.
- `findQuadraticNonResidue(p)` / `findSexticNonResidue(fp2Params)` — the underlying non-residue
  search, exposed in case you want to pick a non-residue via a different strategy than
  `deriveFp2Params`/`deriveFp6Params`'s defaults.
- `jacobiSymbol(a, p)` — the Jacobi symbol, returning `1` / `-1` / `0`. For the prime moduli
  this library targets it is the Legendre symbol, so `1` means "`a` is a nonzero quadratic
  residue mod `p`" — a drop-in, much cheaper replacement for `a^((p-1)/2) mod p`. It is what
  makes the non-residue searches above cheap; **only meaningful for prime `p`** (a composite
  modulus can return `1` for a non-residue).

Every method on `Fp2`/`Fp6`/`Fp12` that returns a new instance carries `this.params` forward
automatically, so a tower built this way stays self-consistent through chained calls without
needing to pass `params` at every step.

The searches don't test candidates by brute-force exponentiation. Quadratic residuosity is
decided with a Jacobi symbol (`O(log² p)` bit operations, no modular exponentiation at all),
and the `Fp2` square/cube tests are pushed down into the base field through the norm map
`N(a + b·u) = a² − nr·b²`, using `c^((q−1)/2) = N(c)^((p−1)/2)` and — when `3 | p−1` —
`c^((q−1)/3) = N(c)^((p−1)/3)`. Deriving the BLS12-381 tower this way takes roughly a sixth
of the time the naive search did, and picks exactly the same non-residues.

### Using with BLS12-381

BLS12-381 (used by Ethereum's consensus layer, Zcash Sapling, and most modern BLS signature
schemes) is, like BN254, a pairing-friendly curve with embedding degree 12 — its `Fp2`/`Fp6`/
`Fp12` tower is the same shape this library already builds, just over a different (381-bit)
prime. `Bls12381Parameters` ships as a ready-made `{p, n}` pair, so building the tower is the
same three calls as [any other tunable prime](#tunable-curve-parameters):

```js
const {
  Fp2,
  Fp6,
  Fp12,
  Bls12381Parameters,
  deriveFp2Params,
  deriveFp6Params,
  deriveFp12Params,
} = require("alg-field");

const fp2Params = deriveFp2Params(Bls12381Parameters.p);
const fp6Params = deriveFp6Params(fp2Params);
const fp12Params = deriveFp12Params(fp6Params);

const a = new Fp2(3n, 5n, fp2Params);
const one = Fp12.one(fp12Params);
```

The derived non-residues aren't just *some* valid choice — they match BLS12-381's actual
published convention exactly (`Fp2`'s is `-1`, `Fp6`'s is `1 + u`), confirmed in the test suite.

[`Field12`](#field12) (the direct flat-polynomial representation) works on BLS12-381 too — it
derives its own degree-12 modulus polynomial, `x¹² − 2x⁶ + 2` here, from the tower's sextic
non-residue:

```js
const { Field12, Bls12381Parameters } = require("alg-field");

const one = new Field12(Bls12381Parameters, 1n); // no modulusCoeffs needed
```

### Using with secp256k1

secp256k1 (the curve behind Bitcoin/Ethereum signing) is **not** pairing-friendly — its
embedding degree is astronomically large, so there's no `Fp2`/`Fp6`/`Fp12` tower to build for
it. Only the base field (`Field`) is relevant; just pass its prime as the modulus:

```js
const { Field } = require("alg-field");

const p = 2n ** 256n - 2n ** 32n - 977n; // secp256k1's field modulus

const a = new Field(9n, p);
const b = new Field(2n, p);
a.multiply(a.inverse()).eq(new Field(1n, p)); // true
```

`Field` has no dedicated `.sqrt()`, but secp256k1's `p ≡ 3 (mod 4)` (like BN254's) makes
modular square root a one-liner via the existing `.exp()` — useful for decompressing a point
from just its x-coordinate (`y² = x³ + 7`):

```js
const rhs = x.multiply(x).multiply(x).add(new Field(7n, p)); // x^3 + 7
const y = rhs.exp((p + 1n) / 4n); // sqrt(rhs), since rhs is a quadratic residue
// the other root is y.negate() - pick whichever matches the compressed point's parity byte
```

### `Field2`

An independent `Fp2 = Fp[i]/(i² + 1)` implementation (`i² = -1`), separate from the `Fp2` tower
above. Only forms a field when the modulus is `≡ 3 (mod 4)` — otherwise `-1` is a square, `x² + 1`
factors, and the ring has zero divisors whose `.inverse()` throws;
`Parameters.p` satisfies this. Backs `Field12`'s direct polynomial representation and adds a few
pairing-adjacent helpers (`mulI`/`mulV`, `sqrt`/`cbrt`) that the `Fp2` tower above doesn't expose.

- `new Field2(p, re?, im?, reduce?)` — `new Field2(p)` is `0`; `new Field2(p, re)` embeds a
  base-field scalar; `new Field2(p, re, im, reduce)` sets both components, reducing mod `p`
  first when `reduce` is `true`.
- `.zero()` / `.one()` — identity checks.
- `.eq(o)` — component-wise equality; `false` for non-`Field2` values.
- `.add(o)` / `.subtract(o)` / `.multiply(o)` / `.divide(o)` — accept another `Field2`, or (for
  `add`/`subtract`/`multiply`) a raw `bigint` scalar.
- `.neg()` / `.square()` / `.cube()` / `.inverse()` — shorthand arithmetic.
- `.mulI()` / `.divideI()` — multiply/divide by `i`.
- `.mulV()` / `.divV()` — multiply/divide by `(1 + i)`; exact inverses of one another.
- `.exp(k)` — modular exponentiation by `k` (`bigint` or coercible; negative exponents invert
  first).
- `.sqrt()` / `.cbrt()` — square/cube root via the Adleman–Manders–Miller algorithm generalized
  to `Fp2`; returns `null` when no such root exists.
- `.toString()` — `"[re,im]"`.

### `Field12`

`Fp12` represented directly as `Fp[x]/(x¹² + c₆x⁶ + c₀)` — for BN254 the standard `FQ12`
modulus polynomial `x¹² − 18x⁶ + 82` (as used by e.g. `py_ecc`) — rather than as the
`Fp2`/`Fp6`/`Fp12` tower above. Elements are stored as 6 `Field2` pairs (`.v`); full
multiplication and inversion unpack to the 12 flat base-field coefficients to do the polynomial
arithmetic (convolution + reduction for multiply, extended Euclidean algorithm for inverse),
then repack.

The modulus polynomial is derived from `bn.p`, not hardcoded, so `Field12` works for any
supported prime. It is the minimal polynomial over `Fp` of the tower's generator `w`: from
`w⁶ = ξ = a + b·u` (the `Fp6` sextic non-residue) and `u² = nr`, squaring `w⁶ − a = b·u` gives
`x¹² − 2a·x⁶ + (a² − nr·b²)`. For BN254 (`ξ = 9 + u`) that is exactly `x¹² − 18x⁶ + 82`; for
BLS12-381 (`ξ = 1 + u`), `x¹² − 2x⁶ + 2`. Results are memoized per modulus, so the derivation
happens at most once per curve.

- `new Field12(bn, k)` — `bn` is any `{p, n}` curve-parameter pair (`Parameters` and
  `Bls12381Parameters` both work directly); `k` is a `bigint` (embeds a scalar), an array of 6
  `Field2` (the raw `.v`), or omitted-shape fallback. `new Field12(other)` (single `Field12`
  argument) clones `other`. `bn` may also carry an optional `modulusCoeffs` (12 `bigint`s,
  low-to-high degree, monic implied) to override the derived modulus polynomial described
  above.
- `.zero()` / `.one()` — identity checks.
- `.eq(o)` — component-wise equality; `false` for non-`Field12` values.
- `.add(k)` / `.subtract(k)` — field arithmetic against another `Field12` (same `bn.p`).
- `.multiply(k)` / `.divide(k)` — accept another `Field12`, or a raw `bigint`/`Field2` scalar
  applied component-wise.
- `.neg()` / `.inverse()` — shorthand arithmetic.
- `.mulV()` / `.divV()` — multiply/divide by `x`, the extension's formal generator; exact
  inverses of one another.
- `.exp(k)` — modular exponentiation by `k` (`bigint` or coercible).
- `.finExp()` — raises to `(bn.p¹² − 1) / bn.n`, the pairing final-exponentiation power.
- `.split()` / `.join(flat)` — convert to/from the flat 12-coefficient representation; mostly
  an internal detail of `multiply`/`inverse`, exposed for advanced use.
- `.toString()` — lists all 6 components' `re`/`im` values.

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
