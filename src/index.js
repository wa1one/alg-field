require("./bigint-extend");

const Parameters = require("./parameters");
const Bls12381Parameters = require("./bls12-381-parameters");
const BN254_TOWER = require("./bn254-tower-constants");

// Curve-specific constants (non-residues, Frobenius coefficient tables) can be derived from
// any modulus via the derive* helpers below, so the tower works for any prime - not just
// Parameters.p. The default (BN254) parameters, however, are built from the precomputed
// constants in bn254-tower-constants.js: the generic derivation brute-forces the sextic
// non-residue and exponentiates for every Frobenius coefficient, which costs close to a
// second at import time. A unit test re-runs the derivation and asserts it still matches
// the hardcoded constants. These two helpers work on raw BigInt (no Field dependency yet)
// to avoid a circular reference from Field's own static initializers.
function modPow(base, exp, p) {
  base = base.mod(p);
  let result = 1n;
  while (exp > 0n) {
    if (exp & 1n) result = (result * base).mod(p);
    base = (base * base).mod(p);
    exp >>= 1n;
  }
  return result;
}

// Jacobi symbol (a/n) for odd n > 0, by the binary/reciprocity algorithm: O(log^2 n) bit
// operations, versus a full modular exponentiation for Euler's criterion. For the prime
// moduli this library works with, the Jacobi symbol coincides with the Legendre symbol, so
// jacobiSymbol(a, p) === 1 means "a is a nonzero quadratic residue mod p" (0 means p | a).
// Only valid for prime p - a composite n can return 1 for a non-residue.
function jacobiSymbol(a, n) {
  a = a.mod(n);
  let result = 1;
  while (a !== 0n) {
    while (a % 2n === 0n) {
      a /= 2n;
      // (2/n) = -1 exactly when n = 3 or 5 (mod 8)
      const nMod8 = n % 8n;
      if (nMod8 === 3n || nMod8 === 5n) result = -result;
    }
    // quadratic reciprocity: swap, flipping sign when both are 3 (mod 4)
    [a, n] = [n, a];
    if (a % 4n === 3n && n % 4n === 3n) result = -result;
    a = a.mod(n);
  }
  return n === 1n ? result : 0;
}

// -1 is a quadratic non-residue whenever p = 3 (mod 4); otherwise search upward from 2,
// testing each candidate with the Jacobi symbol rather than Euler's criterion.
function findQuadraticNonResidue(p) {
  if (p % 4n === 3n) return (-1n).mod(p);
  for (let k = 2n; ; k++) {
    if (jacobiSymbol(k, p) !== 1) return k;
  }
}

// Operand coercion for the Fp/Fp2/Fp6/Fp12 tower. Each level accepts its own type plus any
// lower one (embedded with zero higher components) and raw bigint/number scalars, so mixed-
// level arithmetic like fp12.multiply(2n) or fp2.multiply(someField) works the same way
// Field.multiply(someFp2) always has. Embedding is not a shortcut: multiplying by a scalar
// embedded as (k, 0, ...) gives exactly the component-wise scaling the fast paths below use.
// Each returns null for an operand it cannot interpret; callers turn that into an error.
function toField(value, p) {
  if (value instanceof Field) return value;
  if (
    typeof value === "bigint" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return new Field(value, p);
  }
  return null;
}

function toFp2(value, params) {
  if (value instanceof Fp2) return value;
  const scalar = toField(value, params.p);
  return scalar === null
    ? null
    : new Fp2(scalar, new Field(0n, params.p), params);
}

function toFp6(value, params) {
  if (value instanceof Fp6) return value;
  const fp2Params = params.nonResidue.params;
  const lower = toFp2(value, fp2Params);
  return lower === null
    ? null
    : new Fp6(lower, Fp2.zero(fp2Params), Fp2.zero(fp2Params), params);
}

function toFp12(value, params) {
  if (value instanceof Fp12) return value;
  const lower = toFp6(value, params.fp6Params);
  return lower === null
    ? null
    : new Fp12(lower, Fp6.zero(params.fp6Params), params);
}

function requireOperand(coerced, value, expected) {
  if (coerced === null) {
    throw new Error(
      `Incorrect type argument: expected ${expected}, a lower tower level, or a scalar, got ${typeof value}`
    );
  }
  return coerced;
}

// Field2/Field12 hold raw bigint coefficients rather than Field instances, so a scalar
// operand there is normalized straight down to a bigint. Accepts a bigint, a number/string,
// or a Field (whose value is taken); null for anything else.
function toScalarBigInt(value) {
  if (typeof value === "bigint") return value;
  if (value instanceof Field) return value.v;
  if (typeof value === "number" || typeof value === "string") {
    return BigInt(value);
  }
  return null;
}

// Rung of the tower a value sits on; 0 for raw scalars and anything unrecognized.
function towerLevel(value) {
  if (value instanceof Fp12) return 4;
  if (value instanceof Fp6) return 3;
  if (value instanceof Fp2) return 2;
  if (value instanceof Field) return 1;
  return 0;
}

// When the operand sits *strictly higher* than the receiver, embed the receiver up to that
// level so the operation completes there - the result of mixing two levels always lives at
// the higher one. Returns null when no lift is needed (same level or lower), which is what
// keeps same-level calls from recursing back into themselves.
function liftTo(self, value) {
  if (towerLevel(value) <= towerLevel(self)) return null;
  if (value instanceof Fp12) return toFp12(self, value.params);
  if (value instanceof Fp6) return toFp6(self, value.params);
  return toFp2(self, value.params);
}

class Field {
  static _0 = new Field(0n);
  static _1 = new Field(1n);
  static NON_RESIDUE = new Field(findQuadraticNonResidue(Parameters.p));
  static _2_INV = new Field(2n.modInv(Parameters.p));

  constructor(v, p) {
    if (typeof v !== "bigint") {
      this.v = BigInt(v);
    } else {
      this.v = v;
    }
    if (typeof p === "undefined") {
      this.p = Parameters.p;
    } else if (typeof p !== "bigint") {
      this.p = BigInt(p);
    } else {
      this.p = p;
    }
  }

  add = (o) => {
    const lifted = liftTo(this, o);
    if (lifted !== null) return lifted.add(o);
    const other = requireOperand(toField(o, this.p), o, "a Field");
    return new Field((this.v + other.v).mod(this.p), this.p);
  };

  multiply = (o) => {
    // An Fp2 operand scales both of its components. Kept as an explicit branch rather than
    // going through liftTo: it predates the generic path and is cheaper than embedding.
    if (o instanceof Fp2) {
      return new Fp2(o.a.multiply(this), o.b.multiply(this), o.params);
    }
    const lifted = liftTo(this, o);
    if (lifted !== null) return lifted.multiply(o);
    const other = requireOperand(toField(o, this.p), o, "a Field");
    return new Field((this.v * other.v).mod(this.p), this.p);
  };

  subtract = (o) => {
    const lifted = liftTo(this, o);
    if (lifted !== null) return lifted.subtract(o);
    const other = requireOperand(toField(o, this.p), o, "a Field");
    return new Field((this.v - other.v).mod(this.p), this.p);
  };

  square = () => new Field((this.v * this.v).mod(this.p), this.p);

  double = () => new Field((this.v + this.v).mod(this.p), this.p);
  inverse = () => new Field(this.v.modInv(this.p), this.p);

  divide = (o) => {
    const lifted = liftTo(this, o);
    if (lifted !== null) return lifted.divide(o);
    const other = requireOperand(toField(o, this.p), o, "a Field");
    return new Field((this.v * other.inverse().v).mod(this.p), this.p);
  };
  negate = () => new Field((-this.v).mod(this.p), this.p);

  isZero = () => this.v === 0n;

  exp(k) {
    let w = this;
    if (typeof k !== "bigint") {
      k = BigInt(k);
    }

    for (let i = k.bitLength() - 2; i >= 0; i--) {
      w = w.square();
      if (k.testBit(i)) {
        w = w.multiply(this);
      }
    }
    return w;
  }

  bytes = () => {
    const result = [];
    let i = 0;
    let bigNumber = this.v;
    while (bigNumber > 0n) {
      result[i] = parseInt(bigNumber % 256n);
      bigNumber /= 256n;
      i++;
    }
    return result;
  };

  eq = (o) => this.v === o.v;

  toString = () => this.v.toString();
}

// Derives the Fp2 = Fp[u]/(u^2 - nonResidue) parameters for a given prime p: the non-residue
// itself (a Field), and the Frobenius coefficient table indexed by power % 2 (coefficient[i] =
// nonResidue^((p^i - 1)/2), with coefficient[0] = 1 by definition).
function deriveFp2Params(p, nonResidueOverride) {
  const nonResidue = nonResidueOverride ?? new Field(findQuadraticNonResidue(p), p);
  const one = new Field(1n, p);
  // Computed via the dependency-free modPow, not Field.exp()/multiply(): this runs while Fp2
  // is still being defined (as Fp2.defaultParams), and Field.multiply() references Fp2 by
  // name for its scalar-times-Fp2 branch, which would throw (TDZ) if reached from here.
  const coeff1 = new Field(modPow(nonResidue.v, (p - 1n) / 2n, p), p);
  return { p, nonResidue, frobeniusCoeffsB: [one, coeff1] };
}

class Fp2 {
  static defaultParams = deriveFp2Params(Parameters.p);

  static one = (params = Fp2.defaultParams) =>
    new Fp2(new Field(1n, params.p), new Field(0n, params.p), params);

  static zero = (params = Fp2.defaultParams) =>
    new Fp2(new Field(0n, params.p), new Field(0n, params.p), params);

  static _0 = Fp2.zero();
  static _1 = Fp2.one();

  // Fp2.NON_RESIDUE is set below, once Fp6 exists: it historically held the Fp6-level
  // non-residue (9+u), not Fp2's own construction non-residue (-1) - see mulByNonResidue().
  static FROBENIUS_COEFFS_B = Fp2.defaultParams.frobeniusCoeffsB;

  constructor(a, b, params) {
    this.params = params ?? Fp2.defaultParams;
    this.a = a instanceof Field ? a : new Field(a, this.params.p);
    this.b = b instanceof Field ? b : new Field(b, this.params.p);
  }

  square() {
    const ab = this.a.multiply(this.b);
    // ra = (a + b)(a + NON_RESIDUE * b) - ab - NON_RESIDUE * b
    const ra = this.a
      .add(this.b)
      .multiply(this.b.multiply(this.params.nonResidue).add(this.a))
      .subtract(ab)
      .subtract(ab.multiply(this.params.nonResidue));

    const rb = ab.double();

    return new Fp2(ra, rb, this.params);
  }

  multiply(o) {
    const lifted = liftTo(this, o);
    if (lifted !== null) return lifted.multiply(o);
    if (!(o instanceof Fp2)) {
      // A Field or raw scalar scales both components - the same result embedding it as
      // (k, 0) and running the general formula would give, for a fraction of the work.
      const scalar = requireOperand(toField(o, this.params.p), o, "an Fp2");
      return new Fp2(
        this.a.multiply(scalar),
        this.b.multiply(scalar),
        this.params
      );
    }

    const aa = this.a.multiply(o.a);
    const bb = this.b.multiply(o.b);
    // ra = a1 * a2 + NON_RESIDUE * b1 * b2
    const ra = bb.multiply(this.params.nonResidue).add(aa);
    // rb = (a1 + b1)(a2 + b2) - a1 * a2 - b1 * b2
    const rb = this.a
      .add(this.b)
      .multiply(o.a.add(o.b))
      .subtract(aa)
      .subtract(bb);

    return new Fp2(ra, rb, this.params);
  }

  add = (o) => {
    const lifted = liftTo(this, o);
    if (lifted !== null) return lifted.add(o);
    const other = requireOperand(toFp2(o, this.params), o, "an Fp2");
    return new Fp2(this.a.add(other.a), this.b.add(other.b), this.params);
  };

  subtract = (o) => {
    const lifted = liftTo(this, o);
    if (lifted !== null) return lifted.subtract(o);
    const other = requireOperand(toFp2(o, this.params), o, "an Fp2");
    return new Fp2(
      this.a.subtract(other.a),
      this.b.subtract(other.b),
      this.params
    );
  };

  double = () => this.add(this);

  divide = (o) => {
    const lifted = liftTo(this, o);
    if (lifted !== null) return lifted.divide(o);
    return this.multiply(
      requireOperand(toFp2(o, this.params), o, "an Fp2").inverse()
    );
  };

  inverse() {
    const t0 = this.a.square();
    const t1 = this.b.square();
    const t2 = t0.subtract(this.params.nonResidue.multiply(t1));
    const t3 = t2.inverse();

    const ra = this.a.multiply(t3);
    const rb = this.b.multiply(t3).negate();

    return new Fp2(ra, rb, this.params);
  }

  negate = () => new Fp2(this.a.negate(), this.b.negate(), this.params);

  isZero = () => this.a.isZero() && this.b.isZero();

  eq(o) {
    if (!(o instanceof Fp2)) return false;

    if (this.a != null ? !this.a.eq(o.a) : o.a != null) return false;
    return !(this.b != null ? !this.b.eq(o.b) : o.b != null);
  }

  frobeniusMap(power) {
    const ra = this.a;
    const rb = this.params.frobeniusCoeffsB[power % 2n].multiply(this.b);

    return new Fp2(ra, rb, this.params);
  }

  // Multiplies by the Fp6-level non-residue (Fp2.NON_RESIDUE), not this instance's own
  // construction non-residue - kept for backward compatibility with the default BN254 tower.
  // Fp6's own methods use their instance's params directly instead of this shortcut, so it
  // works correctly for any curve; this convenience method only reflects the default one.
  mulByNonResidue = () => Fp2.NON_RESIDUE.multiply(this);

  exp(k) {
    let w = this;
    if (typeof k !== "bigint") {
      k = BigInt(k);
    }
    const st = k.bitLength() - 2;
    for (let i = st; i >= 0; i--) {
      w = w.square();
      if (k.testBit(i)) {
        w = w.multiply(this);
      }
    }
    return w;
  }

  toString = () => this.a.toString() + ", " + this.b.toString();
}

// Norm of a + b*u from Fp2 down to Fp, for u^2 = nonResidue: N(c) = a^2 - nonResidue * b^2.
// Equivalently c * conj(c), i.e. c^(1+p). It is the bridge that lets the residue tests below
// run in the base field instead of in Fp2.
function fp2Norm(a, b, nonResidue, p) {
  return (a * a - nonResidue * (b * b)).mod(p);
}

// Whether c = a + b*u is a square in Fp2. Since c^((q-1)/2) == N(c)^((p-1)/2) (q = p^2), the
// test collapses to a Legendre symbol on the norm - no exponentiation at all.
function fp2IsSquare(a, b, nonResidue, p) {
  return jacobiSymbol(fp2Norm(a, b, nonResidue, p), p) === 1;
}

// Whether c = a + b*u is a cube in Fp2.
// When 3 | p-1 the same norm identity applies (c^((q-1)/3) == N(c)^((p-1)/3)), turning a
// ~2*log(p)-bit Fp2 exponentiation into a single ~log(p)-bit base-field one. When p = 2
// (mod 3) that identity does not hold - every element of Fp* is then a cube, so the norm
// carries no information - and the Fp2 exponentiation is used directly.
function fp2IsCube(a, b, nonResidue, p, fp2Params) {
  if ((p - 1n) % 3n === 0n) {
    return modPow(fp2Norm(a, b, nonResidue, p), (p - 1n) / 3n, p) === 1n;
  }
  const q = p * p;
  return new Fp2(a, b, fp2Params)
    .exp((q - 1n) / 3n)
    .eq(new Fp2(1n, 0n, fp2Params));
}

// Finds an Fp2 sextic non-residue (neither a square nor a cube in Fp2 - field size q = p^2):
// a natural search over (re, im) with im=0,1,2,... outer and re=1,2,3,... inner, returning the
// first candidate that satisfies both. For Parameters.p this reproduces exactly 9+u, and for
// BLS12-381 exactly 1+u - both curves' canonical published values.
function findSexticNonResidue(fp2Params) {
  const p = fp2Params.p;
  const nonResidue = fp2Params.nonResidue.v;
  for (let im = 0n; im < 50n; im++) {
    for (let re = 1n; re < 50n; re++) {
      if (fp2IsSquare(re, im, nonResidue, p)) continue;
      if (fp2IsCube(re, im, nonResidue, p, fp2Params)) continue;
      return new Fp2(re, im, fp2Params);
    }
  }
  throw new Error("could not find a sextic non-residue in Fp2");
}

// Derives the Fp6 = Fp2[v]/(v^3 - nonResidue) parameters: the non-residue (an Fp2), and the
// Frobenius coefficient tables indexed by power % 6 (coefficientB[i] = nonResidue^((p^i-1)/3),
// coefficientC[i] = nonResidue^((p^i-1)/3 * 2), both 1 at i = 0 by definition).
function deriveFp6Params(fp2Params, nonResidueOverride) {
  const p = fp2Params.p;
  const nonResidue = nonResidueOverride ?? findSexticNonResidue(fp2Params);
  const one = new Fp2(1n, 0n, fp2Params);
  const frobeniusCoeffsB = [one];
  const frobeniusCoeffsC = [one];
  for (let i = 1; i < 6; i++) {
    const pi = p ** BigInt(i);
    frobeniusCoeffsB.push(nonResidue.exp((pi - 1n) / 3n));
    frobeniusCoeffsC.push(nonResidue.exp(((pi - 1n) / 3n) * 2n));
  }
  return { p, nonResidue, frobeniusCoeffsB, frobeniusCoeffsC };
}

// Builds the default (BN254) Fp6 parameters from the precomputed constants - identical in
// every value to deriveFp6Params(Fp2.defaultParams), without the import-time derivation cost.
function bn254Fp6Params() {
  const fp2 = (pair) => new Fp2(pair[0], pair[1], Fp2.defaultParams);
  return {
    p: Parameters.p,
    nonResidue: fp2(BN254_TOWER.fp6NonResidue),
    frobeniusCoeffsB: BN254_TOWER.fp6FrobeniusCoeffsB.map(fp2),
    frobeniusCoeffsC: BN254_TOWER.fp6FrobeniusCoeffsC.map(fp2),
  };
}

class Fp6 {
  static defaultParams = bn254Fp6Params();

  static one = (params = Fp6.defaultParams) => {
    const fp2Params = params.nonResidue.params;
    return new Fp6(Fp2.one(fp2Params), Fp2.zero(fp2Params), Fp2.zero(fp2Params), params);
  };

  static zero = (params = Fp6.defaultParams) => {
    const fp2Params = params.nonResidue.params;
    return new Fp6(Fp2.zero(fp2Params), Fp2.zero(fp2Params), Fp2.zero(fp2Params), params);
  };

  static _0 = Fp6.zero();
  static _1 = Fp6.one();

  static NON_RESIDUE = Fp6.defaultParams.nonResidue;
  static FROBENIUS_COEFFS_B = Fp6.defaultParams.frobeniusCoeffsB;
  static FROBENIUS_COEFFS_C = Fp6.defaultParams.frobeniusCoeffsC;

  constructor(a, b, c, params) {
    this.params = params ?? Fp6.defaultParams;
    this.a = a;
    this.b = b;
    this.c = c;
  }

  toString = () =>
    "[" +
    this.a.toString() +
    ", " +
    this.b.toString() +
    ", " +
    this.c.toString() +
    "]";

  square() {
    const s0 = this.a.square();
    const ab = this.a.multiply(this.b);
    const s1 = ab.double();
    const s2 = this.a.subtract(this.b).add(this.c).square();
    const bc = this.b.multiply(this.c);
    const s3 = bc.double();
    const s4 = this.c.square();

    const ra = s0.add(this.params.nonResidue.multiply(s3));
    const rb = s1.add(this.params.nonResidue.multiply(s4));
    const rc = s1.add(s2).add(s3).subtract(s0).subtract(s4);

    return new Fp6(ra, rb, rc, this.params);
  }

  double = () => this.add(this);

  multiply(o) {
    if (o instanceof Fp6) {
      const a1 = this.a;
      const b1 = this.b;
      const c1 = this.c;
      const a2 = o.a;
      const b2 = o.b;
      const c2 = o.c;

      const a1a2 = a1.multiply(a2);
      const b1b2 = b1.multiply(b2);
      const c1c2 = c1.multiply(c2);

      const ra = a1a2.add(
        this.params.nonResidue.multiply(
          b1.add(c1).multiply(b2.add(c2)).subtract(b1b2).subtract(c1c2)
        )
      );
      const rb = a1
        .add(b1)
        .multiply(a2.add(b2))
        .subtract(a1a2)
        .subtract(b1b2)
        .add(this.params.nonResidue.multiply(c1c2));
      const rc = a1
        .add(c1)
        .multiply(a2.add(c2))
        .subtract(a1a2)
        .add(b1b2)
        .subtract(c1c2);

      return new Fp6(ra, rb, rc, this.params);
    }
    // An Fp2 (or, since normalization, a Field or raw scalar) scales all three components.
    // Previously anything that was not an Fp6 or Fp2 fell through and returned undefined.
    const lifted = liftTo(this, o);
    if (lifted !== null) return lifted.multiply(o);
    const scalar = requireOperand(
      toFp2(o, this.params.nonResidue.params),
      o,
      "an Fp6"
    );
    return new Fp6(
      this.a.multiply(scalar),
      this.b.multiply(scalar),
      this.c.multiply(scalar),
      this.params
    );
  }

  mulByNonResidue() {
    const ra = this.params.nonResidue.multiply(this.c);
    const rb = this.a;
    const rc = this.b;

    return new Fp6(ra, rb, rc, this.params);
  }

  add(o) {
    const lifted = liftTo(this, o);
    if (lifted !== null) return lifted.add(o);
    const other = requireOperand(toFp6(o, this.params), o, "an Fp6");

    const ra = this.a.add(other.a);
    const rb = this.b.add(other.b);
    const rc = this.c.add(other.c);

    return new Fp6(ra, rb, rc, this.params);
  }

  subtract(o) {
    const lifted = liftTo(this, o);
    if (lifted !== null) return lifted.subtract(o);
    const other = requireOperand(toFp6(o, this.params), o, "an Fp6");

    const ra = this.a.subtract(other.a);
    const rb = this.b.subtract(other.b);
    const rc = this.c.subtract(other.c);

    return new Fp6(ra, rb, rc, this.params);
  }

  inverse() {
    const t0 = this.a.square();
    const t1 = this.b.square();
    const t2 = this.c.square();
    const t3 = this.a.multiply(this.b);
    const t4 = this.a.multiply(this.c);
    const t5 = this.b.multiply(this.c);
    const c0 = t0.subtract(this.params.nonResidue.multiply(t5));
    const c1 = this.params.nonResidue.multiply(t2).subtract(t3);
    const c2 = t1.subtract(t4);
    const t6 = this.a
      .multiply(c0)
      .add(
        this.params.nonResidue.multiply(
          this.c.multiply(c1).add(this.b.multiply(c2))
        )
      )
      .inverse();

    const ra = t6.multiply(c0);
    const rb = t6.multiply(c1);
    const rc = t6.multiply(c2);

    return new Fp6(ra, rb, rc, this.params);
  }

  negate = () =>
    new Fp6(this.a.negate(), this.b.negate(), this.c.negate(), this.params);

  isZero = () => this.a.isZero() && this.b.isZero() && this.c.isZero();

  frobeniusMap(power) {
    const ra = this.a.frobeniusMap(power);
    const rb = this.params.frobeniusCoeffsB[power % 6n].multiply(
      this.b.frobeniusMap(power)
    );
    const rc = this.params.frobeniusCoeffsC[power % 6n].multiply(
      this.c.frobeniusMap(power)
    );

    return new Fp6(ra, rb, rc, this.params);
  }

  eq(fp6) {
    if (!(fp6 instanceof Fp6)) return false;

    if (this.a != null ? !this.a.eq(fp6.a) : fp6.a != null) return false;
    if (this.b != null ? !this.b.eq(fp6.b) : fp6.b != null) return false;
    return !(this.c != null ? !this.c.eq(fp6.c) : fp6.c != null);
  }

  divide = (o) => {
    const lifted = liftTo(this, o);
    if (lifted !== null) return lifted.divide(o);
    return this.multiply(
      requireOperand(toFp6(o, this.params), o, "an Fp6").inverse()
    );
  };

  exp(k) {
    let w = this;
    if (typeof k !== "bigint") {
      k = BigInt(k);
    }

    for (let i = k.bitLength() - 2; i >= 0; i--) {
      w = w.square();
      if (k.testBit(i)) {
        w = w.multiply(this);
      }
    }
    return w;
  }
}

// See the comment on Fp2.prototype.mulByNonResidue: this alias historically held the Fp6-level
// non-residue, not Fp2's own.
Fp2.NON_RESIDUE = Fp6.defaultParams.nonResidue;

// Derives the Fp12 = Fp6[w]/(w^2 - fp6Params.nonResidue) Frobenius coefficient table, indexed
// by power % 12 (coefficient[i] = fp6Params.nonResidue^((p^i-1)/6), 1 at i = 0 by definition).
// Keeps a reference to fp6Params so Fp12.one()/zero() can rebuild a matching Fp6 identity.
function deriveFp12Params(fp6Params) {
  const p = fp6Params.p;
  const frobeniusCoeffsB = [fp6Params.frobeniusCoeffsB[0]];
  for (let i = 1; i < 12; i++) {
    const pi = p ** BigInt(i);
    frobeniusCoeffsB.push(fp6Params.nonResidue.exp((pi - 1n) / 6n));
  }
  return { p, frobeniusCoeffsB, fp6Params };
}

// Builds the default (BN254) Fp12 parameters from the precomputed constants - identical in
// every value to deriveFp12Params(Fp6.defaultParams), without the import-time derivation cost.
function bn254Fp12Params() {
  const fp2 = (pair) => new Fp2(pair[0], pair[1], Fp2.defaultParams);
  return {
    p: Parameters.p,
    frobeniusCoeffsB: BN254_TOWER.fp12FrobeniusCoeffsB.map(fp2),
    fp6Params: Fp6.defaultParams,
  };
}

class Fp12 {
  static defaultParams = bn254Fp12Params();

  static one = (params = Fp12.defaultParams) =>
    new Fp12(Fp6.one(params.fp6Params), Fp6.zero(params.fp6Params), params);

  static zero = (params = Fp12.defaultParams) =>
    new Fp12(Fp6.zero(params.fp6Params), Fp6.zero(params.fp6Params), params);

  static _0 = Fp12.zero();
  static _1 = Fp12.one();

  static FROBENIUS_COEFFS_B = Fp12.defaultParams.frobeniusCoeffsB;

  constructor(a, b, params) {
    this.params = params ?? Fp12.defaultParams;
    this.a = a;
    this.b = b;
  }

  square() {
    const ab = this.a.multiply(this.b);

    const ra = this.a
      .add(this.b)
      .multiply(this.a.add(this.b.mulByNonResidue()))
      .subtract(ab)
      .subtract(ab.mulByNonResidue());
    const rb = ab.add(ab);

    return new Fp12(ra, rb, this.params);
  }

  double() {
    return this.add(this);
  }

  mulBy024(ell0, ellVW, ellVV) {
    const nonResidue = this.a.params.nonResidue;
    const fp6Params = this.a.params;

    let z0 = this.a.a;
    let z1 = this.a.b;
    let z2 = this.a.c;
    let z3 = this.b.a;
    let z4 = this.b.b;
    let z5 = this.b.c;

    const x0 = ell0;
    const x2 = ellVV;
    const x4 = ellVW;

    // const t0, t1, t2, s0, t3, t4, d0, d2, d4, s1

    const d0 = z0.multiply(x0);
    const d2 = z2.multiply(x2);
    const d4 = z4.multiply(x4);
    const t2 = z0.add(z4);
    let t1 = z0.add(z2);
    const s0 = z1.add(z3).add(z5);

    // For z.a_.a_ = z0.
    let s1 = z1.multiply(x2);
    let t3 = s1.add(d4);
    let t4 = nonResidue.multiply(t3).add(d0);
    z0 = t4;

    // For z.a_.b_ = z1
    t3 = z5.multiply(x4);
    s1 = s1.add(t3);
    t3 = t3.add(d2);
    t4 = nonResidue.multiply(t3);
    t3 = z1.multiply(x0);
    s1 = s1.add(t3);
    t4 = t4.add(t3);
    z1 = t4;

    // For z.a_.c_ = z2
    let t0 = x0.add(x2);
    t3 = t1.multiply(t0).subtract(d0).subtract(d2);
    t4 = z3.multiply(x4);
    s1 = s1.add(t4);
    t3 = t3.add(t4);

    // For z.b_.a_ = z3 (z3 needs z2)
    t0 = z2.add(z4);
    z2 = t3;
    t1 = x2.add(x4);
    t3 = t0.multiply(t1).subtract(d2).subtract(d4);
    t4 = nonResidue.multiply(t3);
    t3 = z3.multiply(x0);
    s1 = s1.add(t3);
    t4 = t4.add(t3);
    z3 = t4;

    // For z.b_.b_ = z4
    t3 = z5.multiply(x2);
    s1 = s1.add(t3);
    t4 = nonResidue.multiply(t3);
    t0 = x0.add(x4);
    t3 = t2.multiply(t0).subtract(d0).subtract(d4);
    t4 = t4.add(t3);
    z4 = t4;

    // For z.b_.c_ = z5.
    t0 = x0.add(x2).add(x4);
    t3 = s0.multiply(t0).subtract(s1);
    z5 = t3;

    return new Fp12(
      new Fp6(z0, z1, z2, fp6Params),
      new Fp6(z3, z4, z5, fp6Params),
      this.params
    );
  }

  add = (o) => {
    const other = requireOperand(toFp12(o, this.params), o, "an Fp12");
    return new Fp12(this.a.add(other.a), this.b.add(other.b), this.params);
  };

  divide = (o) =>
    this.multiply(
      requireOperand(toFp12(o, this.params), o, "an Fp12").inverse()
    );

  multiply(o) {
    if (!(o instanceof Fp12)) {
      // An Fp6 or lower scales both components - what embedding it as (o, 0) and running
      // the general formula below would produce, at half the Fp6 multiplications.
      const scalar = requireOperand(
        toFp6(o, this.params.fp6Params),
        o,
        "an Fp12"
      );
      return new Fp12(
        this.a.multiply(scalar),
        this.b.multiply(scalar),
        this.params
      );
    }

    const a2 = o.a,
      b2 = o.b;
    const a1 = this.a,
      b1 = this.b;

    const a1a2 = a1.multiply(a2);
    const b1b2 = b1.multiply(b2);

    const ra = a1a2.add(b1b2.mulByNonResidue());
    const rb = a1.add(b1).multiply(a2.add(b2)).subtract(a1a2).subtract(b1b2);

    return new Fp12(ra, rb, this.params);
  }

  subtract = (o) => {
    const other = requireOperand(toFp12(o, this.params), o, "an Fp12");
    return new Fp12(
      this.a.subtract(other.a),
      this.b.subtract(other.b),
      this.params
    );
  };

  inverse() {
    const t0 = this.a.square();
    const t1 = this.b.square();
    const t2 = t0.subtract(t1.mulByNonResidue());
    const t3 = t2.inverse();

    return new Fp12(this.a.multiply(t3), this.b.multiply(t3).negate(), this.params);
  }

  negate = () => new Fp12(this.a.negate(), this.b.negate(), this.params);

  isZero = () => this.a.isZero() && this.b.isZero();

  frobeniusMap(power) {
    const ra = this.a.frobeniusMap(power);
    const rb = this.b
      .frobeniusMap(power)
      .multiply(this.params.frobeniusCoeffsB[power % 12n]);

    return new Fp12(ra, rb, this.params);
  }

  cyclotomicSquared() {
    const nonResidue = this.a.params.nonResidue;
    const fp6Params = this.a.params;

    let z0 = this.a.a;
    let z4 = this.a.b;
    let z3 = this.a.c;
    let z2 = this.b.a;
    let z1 = this.b.b;
    let z5 = this.b.c;

    let tmp = z0.multiply(z1);
    const t0 = z0
      .add(z1)
      .multiply(z0.add(nonResidue.multiply(z1)))
      .subtract(tmp)
      .subtract(nonResidue.multiply(tmp));
    const t1 = tmp.add(tmp);
    // t2 + t3*y = (z2 + z3*y)^2 = b^2
    tmp = z2.multiply(z3);
    const t2 = z2
      .add(z3)
      .multiply(z2.add(nonResidue.multiply(z3)))
      .subtract(tmp)
      .subtract(nonResidue.multiply(tmp));
    const t3 = tmp.add(tmp);
    // t4 + t5*y = (z4 + z5*y)^2 = c^2
    tmp = z4.multiply(z5);
    const t4 = z4
      .add(z5)
      .multiply(z4.add(nonResidue.multiply(z5)))
      .subtract(tmp)
      .subtract(nonResidue.multiply(tmp));
    const t5 = tmp.add(tmp);

    // for A

    // z0 = 3 * t0 - 2 * z0
    z0 = t0.subtract(z0);
    z0 = z0.add(z0);
    z0 = z0.add(t0);
    // z1 = 3 * t1 + 2 * z1
    z1 = t1.add(z1);
    z1 = z1.add(z1);
    z1 = z1.add(t1);

    // for B

    // z2 = 3 * (xi * t5) + 2 * z2
    tmp = nonResidue.multiply(t5);
    z2 = tmp.add(z2);
    z2 = z2.add(z2);
    z2 = z2.add(tmp);

    // z3 = 3 * t4 - 2 * z3
    z3 = t4.subtract(z3);
    z3 = z3.add(z3);
    z3 = z3.add(t4);

    // z4 = 3 * t2 - 2 * z4
    z4 = t2.subtract(z4);
    z4 = z4.add(z4);
    z4 = z4.add(t2);

    // z5 = 3 * t3 + 2 * z5
    z5 = t3.add(z5);
    z5 = z5.add(z5);
    z5 = z5.add(t3);

    return new Fp12(
      new Fp6(z0, z4, z3, fp6Params),
      new Fp6(z2, z1, z5, fp6Params),
      this.params
    );
  }

  cyclotomicExp(pow) {
    if (typeof pow !== "bigint") pow = BigInt(pow);
    let res = Fp12.one(this.params);

    for (let i = pow.bitLength() - 1; i >= 0; i--) {
      res = res.cyclotomicSquared();

      if (pow.testBit(i)) {
        res = res.multiply(this);
      }
    }

    return res;
  }

  unitaryInverse = () => new Fp12(this.a, this.b.negate(), this.params);

  negExp = (exp) => this.cyclotomicExp(exp).unitaryInverse();

  eq(fp12) {
    if (this === fp12) return true;
    if (!(fp12 instanceof Fp12)) return false;

    if (this.a != null ? !this.a.eq(fp12.a) : fp12.a != null) return false;
    return !(this.b != null ? !this.b.eq(fp12.b) : fp12.b != null);
  }

  toString = () => "[" + this.a.toString() + " " + this.b.toString() + "]";
}

// Field2 is a quadratic extension Fp2 = Fp[i]/(i^2 + 1), independent of the Fp/Fp2/Fp6/Fp12
// tower above (this is a lower-level, BigInteger-oriented API historically used to back
// Field12's direct degree-12 polynomial representation, plus a couple of pairing-adjacent
// helpers - mulI/divideI/mulV/divV, sqrt/cbrt - that the tower above doesn't expose). It only
// forms a field when p is 3 mod 4 (so that -1 has no square root in Fp); Parameters.p satisfies
// this.
class Field2 {
  constructor(p, re, im, reduce) {
    this.p = BigInt(p);

    if (arguments.length === 1) {
      this.re = 0n;
      this.im = 0n;
    } else if (arguments.length === 2) {
      this.re = BigInt(re).mod(this.p);
      this.im = 0n;
    } else {
      this.re = reduce ? BigInt(re).mod(this.p) : BigInt(re);
      this.im = reduce ? BigInt(im).mod(this.p) : BigInt(im);
    }
  }

  zero = () => this.re === 0n && this.im === 0n;

  one = () => this.re === 1n && this.im === 0n;

  eq = (u) =>
    u instanceof Field2 && this.p === u.p && this.re === u.re && this.im === u.im;

  neg = () =>
    new Field2(this.p, (-this.re).mod(this.p), (-this.im).mod(this.p), false);

  add(v) {
    if (v instanceof Field2) {
      if (this.p !== v.p) {
        throw new Error("Operands are in different finite fields");
      }
      return new Field2(
        this.p,
        (this.re + v.re).mod(this.p),
        (this.im + v.im).mod(this.p),
        false
      );
    }
    const scalar = toScalarBigInt(v);
    if (scalar !== null) {
      return new Field2(this.p, (this.re + scalar).mod(this.p), this.im, false);
    }
    throw new Error("Incorrect type argument");
  }

  subtract(v) {
    if (v instanceof Field2) {
      if (this.p !== v.p) {
        throw new Error("Operands are in different finite fields");
      }
      return new Field2(
        this.p,
        (this.re - v.re).mod(this.p),
        (this.im - v.im).mod(this.p),
        false
      );
    }
    const scalar = toScalarBigInt(v);
    if (scalar !== null) {
      return new Field2(this.p, (this.re - scalar).mod(this.p), this.im, false);
    }
    throw new Error("Incorrect type argument");
  }

  multiply(v) {
    if (v instanceof Field2) {
      const re = (this.re * v.re - this.im * v.im).mod(this.p);
      const im = (this.re * v.im + this.im * v.re).mod(this.p);
      return new Field2(this.p, re, im, false);
    }
    const scalar = toScalarBigInt(v);
    if (scalar !== null) {
      return new Field2(
        this.p,
        (this.re * scalar).mod(this.p),
        (this.im * scalar).mod(this.p),
        false
      );
    }
    throw new Error("Incorrect type argument");
  }

  square = () => this.multiply(this);

  cube = () => this.multiply(this).multiply(this);

  inverse() {
    const denom = (this.re * this.re + this.im * this.im).mod(this.p);
    const denomInv = denom.modInv(this.p);
    return new Field2(
      this.p,
      (this.re * denomInv).mod(this.p),
      ((-this.im).mod(this.p) * denomInv).mod(this.p),
      false
    );
  }

  divide(v) {
    if (v instanceof Field2) {
      return this.multiply(v.inverse());
    }
    const scalar = toScalarBigInt(v);
    if (scalar !== null) {
      return this.multiply(new Field2(this.p, scalar).inverse());
    }
    throw new Error("Incorrect type argument");
  }

  // Multiply/divide by i (i^2 = -1).
  mulI = () => new Field2(this.p, (-this.im).mod(this.p), this.re, false);

  divideI = () => new Field2(this.p, this.im, (-this.re).mod(this.p), false);

  // Multiply/divide by (1 + i); mulV/divV are exact inverses of one another by construction.
  mulV = () => this.multiply(new Field2(this.p, 1n, 1n, false));

  divV = () => this.divide(new Field2(this.p, 1n, 1n, false));

  exp(k) {
    if (typeof k !== "bigint") k = BigInt(k);
    if (k < 0n) return this.inverse().exp(-k);

    let result = new Field2(this.p, 1n);
    let base = this;
    while (k > 0n) {
      if (k & 1n) result = result.multiply(base);
      base = base.multiply(base);
      k >>= 1n;
    }
    return result;
  }

  // Square/cube root via the Adleman-Manders-Miller r-th root algorithm, generalized to
  // Fp2 (field size p^2). Returns null when `this` has no such root.
  sqrt = () => fp2NthRoot(this, 2n);

  cbrt = () => fp2NthRoot(this, 3n);

  toString = () => "[" + this.re.toString() + "," + this.im.toString() + "]";
}

// Finds an r-th power non-residue in Field2 (which fixes u^2 = -1, so the norm is re^2 + im^2),
// for prime r. Uses the same base-field residue tests as findSexticNonResidue: a Legendre
// symbol for r = 2, and the norm identity for r = 3 whenever 3 | p-1.
function fp2FindNonResidue(p, r) {
  const minusOne = (-1n).mod(p);
  const one = new Field2(p, 1n);
  const q = p * p;
  const cubeViaNorm = r === 3n && (p - 1n) % 3n === 0n;

  for (let re = 1n; re < 50n; re++) {
    for (let im = 0n; im < 50n; im++) {
      const norm = fp2Norm(re, im, minusOne, p);
      let isResidue;
      if (r === 2n) {
        isResidue = jacobiSymbol(norm, p) === 1;
      } else if (cubeViaNorm) {
        isResidue = modPow(norm, (p - 1n) / 3n, p) === 1n;
      } else {
        isResidue = new Field2(p, re, im, false).exp((q - 1n) / r).eq(one);
      }
      if (!isResidue) return new Field2(p, re, im, false);
    }
  }
  return null;
}

// Adleman-Manders-Miller r-th root algorithm over Fp2 (field size q = p^2), for prime r.
function fp2NthRoot(a, r) {
  const p = a.p;
  const q = p * p;
  const one = new Field2(p, 1n);

  if (a.zero()) return new Field2(p);
  if (!a.exp((q - 1n) / r).eq(one)) return null;

  let t = q - 1n;
  let s = 0n;
  while (t % r === 0n) {
    t /= r;
    s++;
  }
  const order = r ** s;

  const nonResidue = fp2FindNonResidue(p, r);
  if (nonResidue === null) {
    throw new Error("could not find a non-residue element in Fp2");
  }

  const c = nonResidue.exp(t);
  const e = r.modInv(t);
  const m = (r * e - 1n) / t;
  const z = a.exp(e);

  for (let k = 0n; k < order; k++) {
    const wInv = c.exp(k).inverse();
    const candidate = z.multiply(wInv.exp(m));
    if (candidate.exp(r).eq(a)) return candidate;
  }
  return null;
}

// Field12 represents Fp12 directly as Fp[x]/(x^12 + c6*x^6 + c0) - for BN254 the standard
// FQ12 modulus polynomial x^12 - 18x^6 + 82 (as used by e.g. py_ecc's optimized_bn128) -
// rather than as the Fp2/Fp6/Fp12 tower built above. Elements are stored packed as 6 Field2
// pairs (this.v), which is how add/subtract/negate/scalar-multiply operate directly; the full
// Field12 multiply/inverse unpack to the 12 flat Fp coefficients (via split()/join()) to do
// the polynomial arithmetic, mirroring that reference implementation.
//
// `bn` is any {p, n} pair of curve parameters (Parameters and Bls12381Parameters both satisfy
// this shape directly); `p` must be the same modulus used to build the Field2 coefficients.
// The modulus polynomial is derived from `p` automatically (see deriveField12ModulusCoeffs);
// `bn` may also carry an explicit `modulusCoeffs` (12 bigints, low-to-high degree, monic
// implied) to override that choice.
const FIELD12_DEGREE = 12;
const FIELD12_MODULUS_COEFFS = [82n, 0n, 0n, 0n, 0n, 0n, -18n, 0n, 0n, 0n, 0n, 0n];

// The degree-12 modulus polynomial is not arbitrary: it is the minimal polynomial over Fp of
// the tower's own generator w, where w^6 = xi = a + b*u is the Fp6 sextic non-residue and
// u^2 = nr is the Fp2 one. From w^6 - a = b*u, squaring gives
//     w^12 - 2a*w^6 + (a^2 - nr*b^2) = 0,
// so coeffs[0] = a^2 - nr*b^2 and coeffs[6] = -2a (all others zero), in the low-to-high,
// monic-implied convention used above. For BN254 (xi = 9+u, nr = -1) this reproduces exactly
// [82, 0, 0, 0, 0, 0, -18, 0, 0, 0, 0, 0]; for BLS12-381 (xi = 1+u) it gives x^12 - 2x^6 + 2.
// Irreducibility follows from xi being a sextic non-residue, and is checked by unit tests.
function deriveField12ModulusCoeffs(fp6Params) {
  const p = fp6Params.p;
  const xi = fp6Params.nonResidue;
  const a = xi.a.v;
  const b = xi.b.v;
  if (b === 0n) {
    throw new Error(
      "cannot derive a degree-12 modulus polynomial from a sextic non-residue with no u-component"
    );
  }
  const nonResidue = xi.params.nonResidue.v;
  const coeffs = new Array(FIELD12_DEGREE).fill(0n);
  coeffs[0] = (a * a - nonResidue * (b * b)).mod(p);
  coeffs[6] = (-2n * a).mod(p);
  return coeffs;
}

// Deriving the polynomial means deriving the whole Fp2/Fp6 tower for that prime, so results
// are memoized per modulus. BN254 is seeded with its precomputed constants (a unit test
// asserts the derivation reproduces them exactly), keeping the default path allocation-free.
const field12ModulusCoeffsCache = new Map([
  [Parameters.p, FIELD12_MODULUS_COEFFS],
]);

function field12ModulusCoeffsFor(bn) {
  if (bn.modulusCoeffs) return bn.modulusCoeffs;
  const cached = field12ModulusCoeffsCache.get(bn.p);
  if (cached) return cached;
  const coeffs = deriveField12ModulusCoeffs(
    deriveFp6Params(deriveFp2Params(bn.p))
  );
  field12ModulusCoeffsCache.set(bn.p, coeffs);
  return coeffs;
}

function field12PolyDeg(poly) {
  let d = poly.length - 1;
  while (d > 0 && poly[d] === 0n) d -= 1;
  return d;
}

function field12PolyRoundedDiv(a, b, p) {
  const dega = field12PolyDeg(a);
  const degb = field12PolyDeg(b);
  const temp = a.slice();
  const o = new Array(a.length).fill(0n);
  const bInv = b[degb].modInv(p);
  for (let i = dega - degb; i >= 0; i--) {
    o[i] = (o[i] + (temp[degb + i] * bInv).mod(p)).mod(p);
    for (let c = 0; c <= degb; c++) {
      temp[c + i] = (temp[c + i] - (o[i] * b[c]).mod(p)).mod(p);
    }
  }
  return o.slice(0, field12PolyDeg(o) + 1);
}

function field12PolyMultiply(a, b, p, modulusCoeffs = FIELD12_MODULUS_COEFFS) {
  const result = new Array(FIELD12_DEGREE * 2 - 1).fill(0n);
  for (let i = 0; i < FIELD12_DEGREE; i++) {
    for (let j = 0; j < FIELD12_DEGREE; j++) {
      result[i + j] = (result[i + j] + (a[i] * b[j]).mod(p)).mod(p);
    }
  }
  while (result.length > FIELD12_DEGREE) {
    const exp = result.length - FIELD12_DEGREE - 1;
    const top = result.pop();
    for (let i = 0; i < FIELD12_DEGREE; i++) {
      result[exp + i] = (
        result[exp + i] - (top * modulusCoeffs[i]).mod(p)
      ).mod(p);
    }
  }
  return result;
}

function field12PolyInverse(aCoeffs, p, modulusCoeffs = FIELD12_MODULUS_COEFFS) {
  let lm = [1n, ...new Array(FIELD12_DEGREE).fill(0n)];
  let hm = new Array(FIELD12_DEGREE + 1).fill(0n);
  let low = [...aCoeffs, 0n];
  let high = [...modulusCoeffs, 1n];

  while (field12PolyDeg(low) !== 0) {
    let r = field12PolyRoundedDiv(high, low, p);
    r = r.concat(new Array(FIELD12_DEGREE + 1 - r.length).fill(0n));

    const nm = hm.slice();
    const newHigh = high.slice();
    for (let i = 0; i <= FIELD12_DEGREE; i++) {
      for (let j = 0; j <= FIELD12_DEGREE - i; j++) {
        nm[i + j] = (nm[i + j] - (lm[i] * r[j]).mod(p)).mod(p);
        newHigh[i + j] = (newHigh[i + j] - (low[i] * r[j]).mod(p)).mod(p);
      }
    }

    const oldLm = lm;
    const oldLow = low;
    lm = nm;
    low = newHigh;
    hm = oldLm;
    high = oldLow;
  }

  const scale = low[0].modInv(p);
  return lm.slice(0, FIELD12_DEGREE).map((c) => (c * scale).mod(p));
}

class Field12 {
  constructor(bn, k) {
    if (arguments.length === 1) {
      if (!(bn instanceof Field12)) {
        throw new Error("Incorrect type argument");
      }
      this.bn = bn.bn;
      this.v = bn.v.slice();
      return;
    }

    this.bn = bn;
    this.v = new Array(6);
    if (typeof k === "bigint") {
      this.v[0] = new Field2(bn.p, k);
      for (let i = 1; i < 6; i++) this.v[i] = new Field2(bn.p);
    } else if (k instanceof Array) {
      for (let i = 0; i < 6; i++) this.v[i] = k[i];
    } else {
      for (let i = 0; i < 6; i++) this.v[i] = new Field2(bn.p, k);
    }
  }

  zero = () => this.v.every((c) => c.zero());

  one = () => this.v[0].one() && this.v.slice(1).every((c) => c.zero());

  eq = (o) => o instanceof Field12 && this.v.every((c, i) => c.eq(o.v[i]));

  neg = () => new Field12(this.bn, this.v.map((c) => c.neg()));

  add(k) {
    if (this.bn.p !== k.bn.p) {
      throw new Error("Operands are in different finite fields");
    }
    return new Field12(
      this.bn,
      this.v.map((c, i) => c.add(k.v[i]))
    );
  }

  subtract(k) {
    if (this.bn.p !== k.bn.p) {
      throw new Error("Operands are in different finite fields");
    }
    return new Field12(
      this.bn,
      this.v.map((c, i) => c.subtract(k.v[i]))
    );
  }

  divide(k) {
    const scalar = k instanceof Field2 ? k : toScalarBigInt(k);
    if (scalar !== null) {
      return new Field12(
        this.bn,
        this.v.map((c) => c.divide(scalar))
      );
    }
    if (k instanceof Field12) {
      return this.multiply(k.inverse());
    }
    throw new Error("Incorrect type argument");
  }

  split() {
    const flat = new Array(FIELD12_DEGREE);
    for (let i = 0; i < 6; i++) {
      flat[i * 2] = this.v[i].re;
      flat[i * 2 + 1] = this.v[i].im;
    }
    return flat;
  }

  join(flat) {
    const v = new Array(6);
    for (let i = 0; i < 6; i++) {
      v[i] = new Field2(this.bn.p, flat[i * 2], flat[i * 2 + 1], true);
    }
    return new Field12(this.bn, v);
  }

  multiply(k) {
    const scalar = k instanceof Field2 ? k : toScalarBigInt(k);
    if (scalar !== null) {
      return new Field12(
        this.bn,
        this.v.map((c) => c.multiply(scalar))
      );
    }
    if (k instanceof Field12) {
      if (this.bn.p !== k.bn.p) {
        throw new Error("Operands are in different finite fields");
      }
      if (this.one()) return k;
      if (k.one()) return this;
      if (this.zero() || k.zero()) return new Field12(this.bn, 0n);

      const product = field12PolyMultiply(
        this.split(),
        k.split(),
        this.bn.p,
        field12ModulusCoeffsFor(this.bn)
      );
      return this.join(product);
    }
    throw new Error("Incorrect type argument");
  }

  // Multiply/divide by x (the degree-12 extension's formal generator), via the already
  // -verified generic multiply()/inverse() rather than a hand-rolled rotation shortcut -
  // mulV/divV are exact inverses of one another by construction.
  mulV = () => this.multiply(this.join([0n, 1n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n]));

  divV = () => this.divide(this.join([0n, 1n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n]));

  inverse() {
    const inv = field12PolyInverse(
      this.split(),
      this.bn.p,
      field12ModulusCoeffsFor(this.bn)
    );
    return this.join(inv);
  }

  exp(k) {
    if (typeof k !== "bigint") k = BigInt(k);
    let w = this;
    for (let i = k.bitLength() - 2; i >= 0; i--) {
      w = w.multiply(w);
      if (k.testBit(i)) {
        w = w.multiply(this);
      }
    }
    return w;
  }

  finExp = () => this.exp((this.bn.p ** 12n - 1n) / this.bn.n);

  toString = () =>
    "[" +
    this.v[0].re.toString() +
    ", " +
    this.v[0].im.toString() +
    ", " +
    this.v[1].re.toString() +
    ", " +
    this.v[1].im.toString() +
    ", " +
    this.v[2].re.toString() +
    ", " +
    this.v[2].im.toString() +
    ", " +
    this.v[3].re.toString() +
    ", " +
    this.v[3].im.toString() +
    ", " +
    this.v[4].re.toString() +
    ", " +
    this.v[4].im.toString() +
    ", " +
    this.v[5].re.toString() +
    ", " +
    this.v[5].im.toString() +
    "]";
}

module.exports = {
  Field,
  Fp2,
  Fp6,
  Fp12,
  Field2,
  Field12,
  Parameters,
  Bls12381Parameters,
  deriveFp2Params,
  deriveFp6Params,
  deriveFp12Params,
  findQuadraticNonResidue,
  findSexticNonResidue,
  deriveField12ModulusCoeffs,
  jacobiSymbol,
};
