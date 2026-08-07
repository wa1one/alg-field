const {
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
  deriveField12ModulusCoeffs,
  findQuadraticNonResidue,
  findSexticNonResidue,
  jacobiSymbol,
} = require("./src");

describe("Fields", function () {
  test("Field without extensions test", function () {
    const _2 = new Field(2n);
    const _4 = new Field(4n);
    const _7 = new Field(7n);
    const _9 = new Field(9n);
    const _11 = new Field(11n);

    expect(_2.multiply(_2).eq(_4)).toBeTruthy();
    expect(_2.divide(_7).add(_9.divide(_7)).eq(_11.divide(_7))).toBeTruthy();
    expect(
      _2.multiply(_7).add(_9.multiply(_7)).eq(_11.multiply(_7))
    ).toBeTruthy();

    expect(_9.exp(Parameters.p).eq(_9)).toBeTruthy();

    expect(JSON.stringify(_9.bytes())).toEqual(JSON.stringify([9]));
  });

  test("Field extension 2 test", function () {
    const x = new Fp2(1n, 0n);
    const f = new Fp2(1n, 2n);
    const fpx = new Fp2(2n, 2n);
    const one = new Fp2(1n, 0n);
    expect(x.add(f).eq(fpx)).toBeTruthy();
    expect(f.divide(f).eq(one)).toBeTruthy();
    expect(
      one.divide(f).add(x.divide(f)).eq(one.add(x).divide(f))
    ).toBeTruthy();
    expect(
      one.multiply(f).add(x.multiply(f)).eq(one.add(x).multiply(f))
    ).toBeTruthy();
    expect(x.exp(Parameters.p * Parameters.p - 1n).eq(one)).toBeTruthy();
  });

  test("Field extension 6 test", function () {
    const x = Fp6._1;

    const f = new Fp6(new Fp2(1n, 2n), new Fp2(3n, 4n), new Fp2(5n, 6n));
    const fpx = new Fp6(new Fp2(2n, 2n), new Fp2(3n, 4n), new Fp2(5n, 6n));
    const one = Fp6._1;

    expect(x.add(f).eq(fpx)).toBeTruthy();
    expect(f.divide(f).eq(one)).toBeTruthy();
    expect(
      one.divide(f).add(x.divide(f)).eq(one.add(x).divide(f))
    ).toBeTruthy();
    expect(
      one.multiply(f).add(x.multiply(f)).eq(one.add(x).multiply(f))
    ).toBeTruthy();
    expect(x.exp(Parameters.p * Parameters.p - 1n).eq(one)).toBeTruthy();
  });

  test("Field extension 12 test", function () {
    const x = Fp12._1;

    const f = new Fp12(
      new Fp6(new Fp2(1n, 2n), new Fp2(3n, 4n), new Fp2(5n, 6n)),
      new Fp6(new Fp2(7n, 8n), new Fp2(9n, 10n), new Fp2(11n, 12n))
    );

    const fpx = new Fp12(
      new Fp6(new Fp2(2n, 2n), new Fp2(3n, 4n), new Fp2(5n, 6n)),
      new Fp6(new Fp2(7n, 8n), new Fp2(9n, 10n), new Fp2(11n, 12n))
    );

    const one = Fp12._1;

    expect(x.add(f).eq(fpx)).toBeTruthy();
    expect(f.divide(f).eq(one)).toBeTruthy();
    expect(
      one.divide(f).add(x.divide(f)).eq(one.add(x).divide(f))
    ).toBeTruthy();
    expect(
      one.multiply(f).add(x.multiply(f)).eq(one.add(x).multiply(f))
    ).toBeTruthy();
  });
});

describe("BigInt extensions", function () {
  test("modInv computes the modular inverse", function () {
    expect(3n.modInv(11n)).toEqual(4n); // 3 * 4 = 12 = 1 (mod 11)
    expect(10n.modInv(17n)).toEqual(12n); // 10 * 12 = 120 = 1 (mod 17)
  });

  test("modInv throws when no inverse exists", function () {
    expect(() => 4n.modInv(8n)).toThrow(RangeError);
  });

  test("toZn reduces into the range [0, p)", function () {
    expect(15n.toZn(7n)).toEqual(1n);
    expect((-1n).toZn(7n)).toEqual(6n);
  });

  test("bitLength returns the bit length of a positive value", function () {
    expect(1n.bitLength()).toEqual(1);
    expect(2n.bitLength()).toEqual(2);
    expect(255n.bitLength()).toEqual(8);
    expect(256n.bitLength()).toEqual(9);
  });

  test("mod normalizes negative values into a non-negative range", function () {
    expect((-1n).mod(7n)).toEqual(6n);
    expect(10n.mod(7n)).toEqual(3n);
  });

  test("testBit reads individual bits", function () {
    const v = 0b1010n;
    expect(v.testBit(0)).toBe(false);
    expect(v.testBit(1)).toBe(true);
    expect(v.testBit(2)).toBe(false);
    expect(v.testBit(3)).toBe(true);
  });
});

describe("Field", function () {
  const p = 13n;

  test("constructor coerces non-bigint input and defaults the modulus", function () {
    const f = new Field(5);
    expect(f.v).toEqual(5n);
    expect(f.p).toEqual(Parameters.p);

    const g = new Field(5n, 13);
    expect(g.p).toEqual(13n);
  });

  test("add/subtract/multiply/square/double reduce modulo p", function () {
    const a = new Field(9n, p);
    const b = new Field(8n, p);

    expect(a.add(b).v).toEqual(4n); // 17 mod 13
    expect(a.subtract(b).v).toEqual(1n);
    expect(b.subtract(a).v).toEqual(12n); // -1 mod 13
    expect(a.multiply(b).v).toEqual(7n); // 72 mod 13
    expect(a.square().v).toEqual(3n); // 81 mod 13
    expect(a.double().v).toEqual(5n); // 18 mod 13
  });

  test("multiply with an Fp2 operand scales both of its components", function () {
    const scaled = new Field(2n).multiply(new Fp2(3n, 4n));
    expect(scaled.eq(new Fp2(6n, 8n))).toBeTruthy();
  });

  test("negate is the additive inverse", function () {
    const a = new Field(9n, p);
    expect(a.add(a.negate()).v.mod(p)).toEqual(0n);
  });

  test("inverse is the multiplicative inverse", function () {
    const a = new Field(9n, p);
    expect(a.multiply(a.inverse()).eq(new Field(1n, p))).toBeTruthy();
  });

  test("divide matches multiplying by the inverse", function () {
    const a = new Field(9n, p);
    const b = new Field(8n, p);
    expect(a.divide(b).eq(a.multiply(b.inverse()))).toBeTruthy();
  });

  test("isZero and eq", function () {
    expect(new Field(0n, p).isZero()).toBeTruthy();
    expect(new Field(1n, p).isZero()).toBeFalsy();
    expect(new Field(5n, p).eq(new Field(5n, p))).toBeTruthy();
    expect(new Field(5n, p).eq(new Field(6n, p))).toBeFalsy();
  });

  test("exp matches repeated multiplication and Fermat's little theorem", function () {
    const a = new Field(9n, p);
    expect(a.exp(p - 1n).eq(new Field(1n, p))).toBeTruthy();
    expect(a.exp(3n).eq(a.multiply(a).multiply(a))).toBeTruthy();
  });

  test("bytes returns the little-endian byte array of the value", function () {
    expect(new Field(9n).bytes()).toEqual([9]);
    expect(new Field(258n).bytes()).toEqual([2, 1]); // 258 = 2 + 1*256
  });

  test("toString", function () {
    expect(new Field(9n).toString()).toEqual("9");
  });
});

describe("Fp2", function () {
  const f = new Fp2(1n, 2n);

  test("constructor wraps raw values in Field and passes through Field instances", function () {
    const wrapped = new Fp2(1n, 2n);
    expect(wrapped.a instanceof Field).toBeTruthy();
    expect(wrapped.b instanceof Field).toBeTruthy();

    const passthrough = new Fp2(new Field(1n), new Field(2n));
    expect(passthrough.eq(wrapped)).toBeTruthy();
  });

  test("multiplicative and additive identities", function () {
    expect(f.multiply(Fp2._1).eq(f)).toBeTruthy();
    expect(f.add(Fp2._0).eq(f)).toBeTruthy();
  });

  test("square matches self-multiplication", function () {
    expect(f.square().eq(f.multiply(f))).toBeTruthy();
  });

  test("double matches self-addition", function () {
    expect(f.double().eq(f.add(f))).toBeTruthy();
  });

  test("negate is the additive inverse", function () {
    expect(f.add(f.negate()).eq(Fp2._0)).toBeTruthy();
  });

  test("inverse is the multiplicative inverse", function () {
    expect(f.multiply(f.inverse()).eq(Fp2._1)).toBeTruthy();
  });

  test("isZero", function () {
    expect(Fp2._0.isZero()).toBeTruthy();
    expect(Fp2._1.isZero()).toBeFalsy();
  });

  test("eq rejects non-Fp2 values instead of throwing", function () {
    expect(f.eq({})).toBeFalsy();
    expect(f.eq(null)).toBeFalsy();
  });

  test("frobeniusMap at index 0 is the identity", function () {
    expect(f.frobeniusMap(0n).eq(f)).toBeTruthy();
    expect(f.frobeniusMap(2n).eq(f)).toBeTruthy();
  });

  test("frobeniusMap applied twice returns the original value", function () {
    expect(f.frobeniusMap(1n).frobeniusMap(1n).eq(f)).toBeTruthy();
  });

  test("mulByNonResidue matches multiplying by NON_RESIDUE", function () {
    expect(f.mulByNonResidue().eq(Fp2.NON_RESIDUE.multiply(f))).toBeTruthy();
  });

  test("exp accepts non-bigint exponents", function () {
    expect(f.exp(3).eq(f.multiply(f).multiply(f))).toBeTruthy();
  });

  test("toString", function () {
    expect(f.toString()).toEqual("1, 2");
  });
});

describe("Fp6", function () {
  const f = new Fp6(new Fp2(1n, 2n), new Fp2(3n, 4n), new Fp2(5n, 6n));

  test("multiplicative and additive identities", function () {
    expect(f.multiply(Fp6._1).eq(f)).toBeTruthy();
    expect(f.add(Fp6._0).eq(f)).toBeTruthy();
  });

  test("multiply with an Fp2 operand scales every component", function () {
    const scaled = f.multiply(Fp2._1);
    expect(scaled.eq(f)).toBeTruthy();
  });

  test("square matches self-multiplication", function () {
    expect(f.square().eq(f.multiply(f))).toBeTruthy();
  });

  test("double matches self-addition", function () {
    expect(f.double().eq(f.add(f))).toBeTruthy();
  });

  test("negate is the additive inverse", function () {
    expect(f.add(f.negate()).eq(Fp6._0)).toBeTruthy();
  });

  test("inverse is the multiplicative inverse", function () {
    expect(f.multiply(f.inverse()).eq(Fp6._1)).toBeTruthy();
  });

  test("mulByNonResidue is consistent with multiply by NON_RESIDUE", function () {
    const viaHelper = f.mulByNonResidue();
    const viaMultiply = new Fp6(Fp2._0, Fp2._1, Fp2._0).multiply(f);
    expect(viaHelper.eq(viaMultiply)).toBeTruthy();
  });

  test("isZero", function () {
    expect(Fp6._0.isZero()).toBeTruthy();
    expect(Fp6._1.isZero()).toBeFalsy();
    expect(f.isZero()).toBeFalsy();
  });

  test("eq rejects non-Fp6 values instead of throwing", function () {
    expect(f.eq({})).toBeFalsy();
    expect(f.eq(null)).toBeFalsy();
  });

  test("frobeniusMap at index 0 is the identity", function () {
    expect(f.frobeniusMap(0n).eq(f)).toBeTruthy();
    expect(f.frobeniusMap(6n).eq(f)).toBeTruthy();
  });

  test("divide matches multiplying by the inverse", function () {
    const other = Fp6._1.add(Fp6._1);
    expect(f.divide(other).eq(f.multiply(other.inverse()))).toBeTruthy();
  });

  test("exp accepts non-bigint exponents", function () {
    expect(f.exp(3).eq(f.multiply(f).multiply(f))).toBeTruthy();
  });

  test("toString", function () {
    expect(f.toString()).toEqual("[1, 2, 3, 4, 5, 6]");
  });
});

describe("Fp12", function () {
  const f = new Fp12(
    new Fp6(new Fp2(1n, 2n), new Fp2(3n, 4n), new Fp2(5n, 6n)),
    new Fp6(new Fp2(7n, 8n), new Fp2(9n, 10n), new Fp2(11n, 12n))
  );
  const one = Fp12._1;

  test("multiplicative and additive identities", function () {
    expect(f.multiply(one).eq(f)).toBeTruthy();
    expect(f.add(Fp12._0).eq(f)).toBeTruthy();
  });

  test("square matches self-multiplication", function () {
    expect(f.square().eq(f.multiply(f))).toBeTruthy();
  });

  test("double matches self-addition", function () {
    expect(f.double().eq(f.add(f))).toBeTruthy();
  });

  test("negate is the additive inverse", function () {
    expect(f.add(f.negate()).eq(Fp12._0)).toBeTruthy();
  });

  test("inverse is the multiplicative inverse", function () {
    expect(f.multiply(f.inverse()).eq(one)).toBeTruthy();
  });

  test("isZero", function () {
    expect(Fp12._0.isZero()).toBeTruthy();
    expect(one.isZero()).toBeFalsy();
  });

  test("eq handles self-reference and non-Fp12 values", function () {
    expect(f.eq(f)).toBeTruthy();
    expect(f.eq({})).toBeFalsy();
  });

  test("frobeniusMap at index 0 is the identity", function () {
    expect(f.frobeniusMap(0n).eq(f)).toBeTruthy();
    expect(f.frobeniusMap(12n).eq(f)).toBeTruthy();
  });

  test("mulBy024 matches dense multiplication by the equivalent sparse element", function () {
    const ell0 = new Fp2(3n, 1n);
    const ellVW = new Fp2(5n, 2n);
    const ellVV = new Fp2(7n, 4n);
    const sparse = new Fp12(
      new Fp6(ell0, Fp2._0, ellVV),
      new Fp6(Fp2._0, ellVW, Fp2._0)
    );

    expect(f.mulBy024(ell0, ellVW, ellVV).eq(f.multiply(sparse))).toBeTruthy();
  });

  test("cyclotomicSquared and cyclotomicExp fix the identity element", function () {
    expect(one.cyclotomicSquared().eq(one)).toBeTruthy();
    expect(one.cyclotomicExp(5n).eq(one)).toBeTruthy();
  });

  test("unitaryInverse is an involution", function () {
    expect(f.unitaryInverse().unitaryInverse().eq(f)).toBeTruthy();
  });

  test("negExp of zero is the identity", function () {
    expect(one.negExp(0n).eq(one)).toBeTruthy();
  });

  test("toString", function () {
    expect(f.toString()).toEqual("[[1, 2, 3, 4, 5, 6] [7, 8, 9, 10, 11, 12]]");
  });
});

// Field2/Field12 represent Fp2/Fp12 directly (Field2 = Fp[i]/(i^2+1), Field12 =
// Fp[x]/(x^12-18x^6+82)), independent of the Fp2/Fp6/Fp12 tower above. They're only valid
// fields for a modulus p = 3 (mod 4); Parameters.p satisfies this.
describe("Field2", function () {
  const p = Parameters.p;
  const one = new Field2(p, 1n);
  const f = new Field2(p, 3n, 5n, false);

  test("constructor variants", function () {
    expect(new Field2(p).zero()).toBeTruthy();
    expect(new Field2(p, 7n).eq(new Field2(p, 7n, 0n, false))).toBeTruthy();
    expect(new Field2(p, -1n, -1n, true).re).toEqual(p - 1n);
  });

  test("zero/one", function () {
    expect(new Field2(p).zero()).toBeTruthy();
    expect(one.one()).toBeTruthy();
    expect(f.zero()).toBeFalsy();
  });

  test("eq rejects non-Field2 values", function () {
    expect(f.eq({})).toBeFalsy();
    expect(f.eq(null)).toBeFalsy();
  });

  test("additive identity and inverse", function () {
    expect(f.add(new Field2(p)).eq(f)).toBeTruthy();
    expect(f.add(f.neg()).zero()).toBeTruthy();
  });

  test("multiplicative identity and inverse", function () {
    expect(f.multiply(one).eq(f)).toBeTruthy();
    expect(f.multiply(f.inverse()).eq(one)).toBeTruthy();
  });

  test("divide matches multiplying by the inverse", function () {
    const g = new Field2(p, 11n, 13n, false);
    expect(f.divide(g).eq(f.multiply(g.inverse()))).toBeTruthy();
  });

  test("square and cube match repeated multiplication", function () {
    expect(f.square().eq(f.multiply(f))).toBeTruthy();
    expect(f.cube().eq(f.multiply(f).multiply(f))).toBeTruthy();
  });

  test("exp matches repeated multiplication", function () {
    expect(f.exp(3n).eq(f.multiply(f).multiply(f))).toBeTruthy();
  });

  test("mulI/divideI are inverses, and i^2 = -1", function () {
    expect(f.mulI().divideI().eq(f)).toBeTruthy();
    expect(f.mulI().mulI().eq(f.neg())).toBeTruthy();
  });

  test("mulV/divV are inverses", function () {
    expect(f.mulV().divV().eq(f)).toBeTruthy();
    expect(f.divV().mulV().eq(f)).toBeTruthy();
  });

  test("sqrt returns a value whose square is the input", function () {
    const square = f.multiply(f);
    const root = square.sqrt();
    expect(root).not.toBeNull();
    expect(root.multiply(root).eq(square)).toBeTruthy();
  });

  test("sqrt returns null for a non-residue", function () {
    // (1,2) is a verified non-quadratic-residue in this Fp2; a square times a non-residue
    // is itself a non-residue, so it must have no square root.
    const nonResidueConst = new Field2(p, 1n, 2n, false);
    const nonResidue = f.multiply(f).multiply(nonResidueConst);
    expect(nonResidue.sqrt()).toBeNull();
  });

  test("cbrt returns a value whose cube is the input", function () {
    const cube = f.multiply(f).multiply(f);
    const root = cube.cbrt();
    expect(root).not.toBeNull();
    expect(root.multiply(root).multiply(root).eq(cube)).toBeTruthy();
  });

  test("toString", function () {
    expect(f.toString()).toEqual("[3,5]");
  });
});

describe("Field12", function () {
  const p = Parameters.p;
  const bn = Parameters;
  const one = new Field12(bn, 1n);
  const f = new Field12(bn, [
    new Field2(p, 1n, 2n),
    new Field2(p, 3n, 4n),
    new Field2(p, 5n, 6n),
    new Field2(p, 7n, 8n),
    new Field2(p, 9n, 10n),
    new Field2(p, 11n, 12n),
  ]);

  test("constructor variants", function () {
    expect(new Field12(bn, 0n).zero()).toBeTruthy();
    expect(one.one()).toBeTruthy();
    expect(new Field12(f).eq(f)).toBeTruthy(); // clone constructor
  });

  test("eq rejects non-Field12 values", function () {
    expect(f.eq({})).toBeFalsy();
  });

  test("additive identity and inverse", function () {
    expect(f.add(new Field12(bn, 0n)).eq(f)).toBeTruthy();
    expect(f.add(f.neg()).zero()).toBeTruthy();
  });

  test("multiplicative identity and inverse", function () {
    expect(f.multiply(one).eq(f)).toBeTruthy();
    expect(f.multiply(f.inverse()).eq(one)).toBeTruthy();
  });

  test("multiply by a scalar matches per-component scalar multiplication", function () {
    const scaled = f.multiply(3n);
    expect(scaled.eq(new Field12(bn, f.v.map((c) => c.multiply(3n))))).toBeTruthy();
  });

  test("divide matches multiplying by the inverse", function () {
    const g = f.add(one);
    expect(f.divide(g).eq(f.multiply(g.inverse()))).toBeTruthy();
  });

  test("mulV/divV are inverses", function () {
    expect(f.mulV().divV().eq(f)).toBeTruthy();
    expect(f.divV().mulV().eq(f)).toBeTruthy();
  });

  test("exp matches repeated multiplication", function () {
    expect(f.exp(3n).eq(f.multiply(f).multiply(f))).toBeTruthy();
  });

  test("finExp of the identity is the identity", function () {
    expect(one.finExp().eq(one)).toBeTruthy();
  });

  test("toString", function () {
    expect(f.toString()).toEqual(
      "[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]"
    );
  });
});

// Field/Fp2/Fp6/Fp12's non-residues and Frobenius coefficient tables are derived at runtime
// rather than hardcoded, so the whole tower works for a modulus other than Parameters.p. This
// only needs p = 3 (mod 4) (so -1 has no square root in Fp, matching this tower's convention).
describe("tunable curve parameters", function () {
  const altP = 10007n; // a small prime, distinct from Parameters.p, with altP % 4n === 3n

  test("altP is a valid modulus for this tower (sanity check on the test fixture)", function () {
    expect(altP % 4n).toEqual(3n);
  });

  test("deriving params for a different prime produces a genuinely different curve", function () {
    const fp2Params = deriveFp2Params(altP);
    expect(fp2Params.p).toEqual(altP);
    expect(fp2Params.nonResidue.eq(Field.NON_RESIDUE)).toBeFalsy();
  });

  test("Field arithmetic works under a custom modulus", function () {
    const a = new Field(9n, altP);
    const b = new Field(8n, altP);
    expect(a.multiply(a.inverse()).eq(new Field(1n, altP))).toBeTruthy();
    expect(a.add(b).p).toEqual(altP);
  });

  test("Fp2 built on altP satisfies field axioms", function () {
    const fp2Params = deriveFp2Params(altP);
    const a = new Fp2(3n, 5n, fp2Params);
    const b = new Fp2(7n, 2n, fp2Params);

    expect(a.multiply(Fp2.one(fp2Params)).eq(a)).toBeTruthy();
    expect(a.multiply(a.inverse()).eq(Fp2.one(fp2Params))).toBeTruthy();
    expect(
      a.multiply(b.add(a)).eq(a.multiply(b).add(a.multiply(a)))
    ).toBeTruthy();
  });

  test("Fp6 built on altP satisfies field axioms", function () {
    const fp2Params = deriveFp2Params(altP);
    const fp6Params = deriveFp6Params(fp2Params);
    const a2 = new Fp2(3n, 5n, fp2Params);
    const b2 = new Fp2(7n, 2n, fp2Params);
    const f = new Fp6(a2, b2, a2, fp6Params);

    expect(f.multiply(Fp6.one(fp6Params)).eq(f)).toBeTruthy();
    expect(f.multiply(f.inverse()).eq(Fp6.one(fp6Params))).toBeTruthy();
    expect(f.frobeniusMap(0n).eq(f)).toBeTruthy();
  });

  test("Fp12 built on altP satisfies field axioms", function () {
    const fp2Params = deriveFp2Params(altP);
    const fp6Params = deriveFp6Params(fp2Params);
    const fp12Params = deriveFp12Params(fp6Params);
    const a2 = new Fp2(3n, 5n, fp2Params);
    const b2 = new Fp2(7n, 2n, fp2Params);
    const a6 = new Fp6(a2, b2, a2, fp6Params);
    const b6 = new Fp6(b2, a2, b2, fp6Params);
    const f = new Fp12(a6, b6, fp12Params);

    expect(f.multiply(Fp12.one(fp12Params)).eq(f)).toBeTruthy();
    expect(f.multiply(f.inverse()).eq(Fp12.one(fp12Params))).toBeTruthy();
    expect(f.square().eq(f.multiply(f))).toBeTruthy();
    expect(f.frobeniusMap(0n).eq(f)).toBeTruthy();
  });

  test("default (Parameters.p) tower is unaffected by using an alternate curve elsewhere", function () {
    // Guards against shared mutable state leaking between the default statics and a custom
    // params object built for a different prime.
    expect(Fp2._1.eq(Fp2.one())).toBeTruthy();
    expect(Fp12._1.eq(Fp12.one())).toBeTruthy();
    expect(Field.NON_RESIDUE.p).toEqual(Parameters.p);
  });
});

// secp256k1 (Bitcoin/Ethereum signing) is y^2 = x^3 + 7 over Fp with p = 2^256 - 2^32 - 977.
// It is NOT a pairing-friendly curve (its embedding degree is astronomically large), so only
// the base field (Field) is relevant - there's no Fp2/Fp6/Fp12 tower to build for it.
describe("using Field with secp256k1", function () {
  const p = 2n ** 256n - 2n ** 32n - 977n;

  // the standard secp256k1 generator point G
  const Gx = new Field(
    55066263022277343669578718895168534326250603453777594175500187360389116729240n,
    p
  );
  const Gy = new Field(
    32670510020758816978083085130507043184471273380659243275938904335757337482424n,
    p
  );

  test("secp256k1's prime satisfies p = 3 (mod 4)", function () {
    expect(p % 4n).toEqual(3n);
  });

  test("field arithmetic works under secp256k1's modulus", function () {
    const a = new Field(9n, p);
    const b = new Field(2n, p);
    expect(a.multiply(a.inverse()).eq(new Field(1n, p))).toBeTruthy();
    expect(a.add(b).p).toEqual(p);
  });

  test("recovers G's y-coordinate from its x-coordinate (point decompression)", function () {
    const rhs = Gx.multiply(Gx).multiply(Gx).add(new Field(7n, p)); // x^3 + 7
    expect(rhs.eq(Gy.multiply(Gy))).toBeTruthy();

    // Field has no dedicated sqrt(), but p = 3 (mod 4) makes it a one-liner via .exp():
    // sqrt(a) = a^((p+1)/4) whenever a is a quadratic residue (as y^2 always is here).
    const candidate = rhs.exp((p + 1n) / 4n);
    expect(candidate.eq(Gy) || candidate.negate().eq(Gy)).toBeTruthy();
  });
});

// BLS12-381 (used by Ethereum's consensus layer, Zcash Sapling, and most modern BLS
// signature schemes) is, unlike secp256k1, a pairing-friendly curve of the same embedding-
// degree-12 shape as BN254 - so the Fp2/Fp6/Fp12 tower applies directly via Bls12381Parameters
// and the derive*Params helpers, the same way as the generic tunable-curve tests above.
describe("using the tower with BLS12-381 parameters", function () {
  const p = Bls12381Parameters.p;
  const n = Bls12381Parameters.n;

  test("matches the published BLS12-381 constants", function () {
    expect(p.toString()).toEqual(
      "4002409555221667393417789825735904156556882819939007885332058136124031650490837864442687629129015664037894272559787"
    );
    expect(n.toString()).toEqual(
      "52435875175126190479447740508185965837690552500527637822603658699938581184513"
    );
    expect(p % 4n).toEqual(3n); // required by this tower's u^2 = -1 convention for Fp2
  });

  test("derived non-residues match BLS12-381's actual published convention", function () {
    // Confirms this isn't just *a* valid tower, but the same one used by real BLS12-381
    // implementations: Fp2's non-residue is -1, and Fp6's is exactly 1 + u.
    const fp2Params = deriveFp2Params(p);
    const fp6Params = deriveFp6Params(fp2Params);

    expect(fp2Params.nonResidue.eq(new Field(p - 1n, p))).toBeTruthy();
    expect(fp6Params.nonResidue.eq(new Fp2(1n, 1n, fp2Params))).toBeTruthy();
  });

  test("Fp2 built on BLS12-381 satisfies field axioms", function () {
    const fp2Params = deriveFp2Params(p);
    const a = new Fp2(3n, 5n, fp2Params);
    const b = new Fp2(7n, 2n, fp2Params);

    expect(a.multiply(Fp2.one(fp2Params)).eq(a)).toBeTruthy();
    expect(a.multiply(a.inverse()).eq(Fp2.one(fp2Params))).toBeTruthy();
    expect(
      a.multiply(b.add(a)).eq(a.multiply(b).add(a.multiply(a)))
    ).toBeTruthy();
  });

  test("Fp6 built on BLS12-381 satisfies field axioms", function () {
    const fp2Params = deriveFp2Params(p);
    const fp6Params = deriveFp6Params(fp2Params);
    const a2 = new Fp2(3n, 5n, fp2Params);
    const b2 = new Fp2(7n, 2n, fp2Params);
    const f = new Fp6(a2, b2, a2, fp6Params);

    expect(f.multiply(Fp6.one(fp6Params)).eq(f)).toBeTruthy();
    expect(f.multiply(f.inverse()).eq(Fp6.one(fp6Params))).toBeTruthy();
    expect(f.frobeniusMap(0n).eq(f)).toBeTruthy();
  });

  test("Fp12 built on BLS12-381 satisfies field axioms", function () {
    const fp2Params = deriveFp2Params(p);
    const fp6Params = deriveFp6Params(fp2Params);
    const fp12Params = deriveFp12Params(fp6Params);
    const a2 = new Fp2(3n, 5n, fp2Params);
    const b2 = new Fp2(7n, 2n, fp2Params);
    const a6 = new Fp6(a2, b2, a2, fp6Params);
    const b6 = new Fp6(b2, a2, b2, fp6Params);
    const f = new Fp12(a6, b6, fp12Params);

    expect(f.multiply(Fp12.one(fp12Params)).eq(f)).toBeTruthy();
    expect(f.multiply(f.inverse()).eq(Fp12.one(fp12Params))).toBeTruthy();
    expect(f.square().eq(f.multiply(f))).toBeTruthy();
    expect(f.frobeniusMap(0n).eq(f)).toBeTruthy();
  });
});

describe("Hardcoded BN254 default tower constants", function () {
  test(
    "default Fp6/Fp12 params match the generic derivation exactly",
    function () {
      const d2 = deriveFp2Params(Parameters.p);
      const d6 = deriveFp6Params(d2);
      const d12 = deriveFp12Params(d6);

      expect(Fp2.defaultParams.nonResidue.eq(d2.nonResidue)).toBeTruthy();
      d2.frobeniusCoeffsB.forEach((c, i) =>
        expect(Fp2.defaultParams.frobeniusCoeffsB[i].eq(c)).toBeTruthy()
      );

      expect(Fp6.defaultParams.nonResidue.eq(d6.nonResidue)).toBeTruthy();
      d6.frobeniusCoeffsB.forEach((c, i) =>
        expect(Fp6.defaultParams.frobeniusCoeffsB[i].eq(c)).toBeTruthy()
      );
      d6.frobeniusCoeffsC.forEach((c, i) =>
        expect(Fp6.defaultParams.frobeniusCoeffsC[i].eq(c)).toBeTruthy()
      );

      d12.frobeniusCoeffsB.forEach((c, i) =>
        expect(Fp12.defaultParams.frobeniusCoeffsB[i].eq(c)).toBeTruthy()
      );

      // the historical alias also points at the Fp6-level non-residue
      expect(Fp2.NON_RESIDUE.eq(d6.nonResidue)).toBeTruthy();
    },
    60000
  );
});

// The non-residue searches use number-theoretic shortcuts rather than testing each candidate
// with a full modular exponentiation: a Jacobi symbol for quadratic residuosity, and the norm
// map N(a + b*u) = a^2 - nr*b^2 to push the Fp2 square/cube tests down into the base field.
describe("jacobiSymbol", function () {
  const p = Parameters.p;

  test("agrees with Euler's criterion on the default modulus", function () {
    for (const a of [1n, 2n, 3n, 4n, 5n, 9n, 12345n, p - 1n]) {
      const euler = new Field(a, p).exp((p - 1n) / 2n);
      const expected = euler.v === 1n ? 1 : -1;
      expect(jacobiSymbol(a, p)).toEqual(expected);
    }
  });

  test("agrees with Euler's criterion on a small prime, exhaustively", function () {
    const small = 10007n;
    for (let a = 1n; a < small; a++) {
      const euler = new Field(a, small).exp((small - 1n) / 2n);
      expect(jacobiSymbol(a, small)).toEqual(euler.v === 1n ? 1 : -1);
    }
  });

  test("is 0 when the modulus divides the argument", function () {
    expect(jacobiSymbol(0n, p)).toEqual(0);
    expect(jacobiSymbol(p, p)).toEqual(0);
  });

  test("perfect squares are always residues", function () {
    for (const root of [2n, 7n, 123456789n]) {
      expect(jacobiSymbol((root * root).mod(p), p)).toEqual(1);
    }
  });
});

describe("non-residue searches", function () {
  test("findQuadraticNonResidue returns an actual non-residue", function () {
    for (const p of [Parameters.p, Bls12381Parameters.p, 10007n, 13n, 17n]) {
      const nr = findQuadraticNonResidue(p);
      expect(jacobiSymbol(nr, p)).toEqual(-1);
    }
  });

  test("findQuadraticNonResidue picks -1 when p = 3 (mod 4)", function () {
    // p = 3 (mod 4) is exactly the condition that makes -1 a non-residue, so the search
    // short-circuits instead of scanning upward from 2.
    expect(Parameters.p % 4n).toEqual(3n);
    expect(findQuadraticNonResidue(Parameters.p)).toEqual(Parameters.p - 1n);
  });

  test("findSexticNonResidue returns a value that is neither a square nor a cube", function () {
    // Verified the slow, direct way: exponentiate in Fp2 by (q-1)/2 and (q-1)/3 and check
    // neither lands on 1 - the definition the optimized search is a shortcut for.
    for (const p of [Parameters.p, 10007n]) {
      const fp2Params = deriveFp2Params(p);
      const xi = findSexticNonResidue(fp2Params);
      const q = p * p;
      const one = new Fp2(1n, 0n, fp2Params);

      expect(xi.exp((q - 1n) / 2n).eq(one)).toBeFalsy();
      expect(xi.exp((q - 1n) / 3n).eq(one)).toBeFalsy();
    }
  });

  test("reproduces each curve's canonical published non-residue", function () {
    // Regression anchors: BN254 must stay 9+u and BLS12-381 must stay 1+u, the values real
    // implementations of these curves use. A change here would silently break interop.
    const bn254 = deriveFp2Params(Parameters.p);
    expect(findSexticNonResidue(bn254).eq(new Fp2(9n, 1n, bn254))).toBeTruthy();

    const bls = deriveFp2Params(Bls12381Parameters.p);
    expect(findSexticNonResidue(bls).eq(new Fp2(1n, 1n, bls))).toBeTruthy();
  });
});

// Field12's degree-12 modulus polynomial is derived from the tower's own sextic non-residue
// rather than hardcoded, so Field12 works for any supported prime - not just BN254.
describe("Field12 modulus polynomial derivation", function () {
  function deriveFor(p) {
    return deriveField12ModulusCoeffs(deriveFp6Params(deriveFp2Params(p)));
  }

  test("reproduces BN254's published x^12 - 18x^6 + 82", function () {
    const p = Parameters.p;
    const coeffs = deriveFor(p);
    expect(coeffs[0]).toEqual(82n);
    expect(coeffs[6]).toEqual((-18n).mod(p));
    coeffs.forEach((c, i) => {
      if (i !== 0 && i !== 6) expect(c).toEqual(0n);
    });
  });

  test("gives BLS12-381 x^12 - 2x^6 + 2", function () {
    const p = Bls12381Parameters.p;
    const coeffs = deriveFor(p);
    expect(coeffs[0]).toEqual(2n);
    expect(coeffs[6]).toEqual((-2n).mod(p));
  });

  test("the derived polynomial actually vanishes on the tower generator", function () {
    // w^6 = xi, so w must satisfy w^12 + c6*w^6 + c0 = 0. Checked in Fp2 arithmetic:
    // substituting w^6 = xi gives xi^2 + c6*xi + c0, which must be zero.
    for (const p of [Parameters.p, Bls12381Parameters.p, 10007n]) {
      const fp2Params = deriveFp2Params(p);
      const fp6Params = deriveFp6Params(fp2Params);
      const xi = fp6Params.nonResidue;
      const coeffs = deriveField12ModulusCoeffs(fp6Params);

      const value = xi
        .multiply(xi)
        .add(xi.multiply(new Fp2(coeffs[6], 0n, fp2Params)))
        .add(new Fp2(coeffs[0], 0n, fp2Params));

      expect(value.isZero()).toBeTruthy();
    }
  });

  test("Field12 satisfies field axioms on BLS12-381 with no hand-supplied coefficients", function () {
    const bn = Bls12381Parameters;
    const p = bn.p;
    const one = new Field12(bn, 1n);
    const build = (seed) => {
      const v = [];
      for (let i = 0; i < 6; i++) {
        v.push(new Field2(p, seed + BigInt(i), seed + BigInt(i) * 7n + 1n, false));
      }
      return new Field12(bn, v);
    };

    const x = build(3n);
    const y = build(11n);
    const z = build(29n);

    expect(x.multiply(one).eq(x)).toBeTruthy();
    expect(x.multiply(x.inverse()).eq(one)).toBeTruthy();
    expect(x.multiply(y).eq(y.multiply(x))).toBeTruthy();
    expect(x.multiply(y.add(z)).eq(x.multiply(y).add(x.multiply(z)))).toBeTruthy();
    expect(x.multiply(y).multiply(z).eq(x.multiply(y.multiply(z)))).toBeTruthy();
    expect(x.mulV().divV().eq(x)).toBeTruthy();
  });

  test("an explicit bn.modulusCoeffs still overrides the derivation", function () {
    const p = Parameters.p;
    const explicit = { p, n: Parameters.n, modulusCoeffs: deriveFor(p) };
    const build = (bn) =>
      new Field12(bn, [
        new Field2(p, 5n, 6n, false),
        new Field2(p, 7n, 8n, false),
        new Field2(p, 9n, 1n, false),
        new Field2(p, 2n, 3n, false),
        new Field2(p, 4n, 5n, false),
        new Field2(p, 6n, 7n, false),
      ]);

    expect(build(explicit).multiply(build(explicit)).eq(build(Parameters).multiply(build(Parameters)))).toBeTruthy();
  });
});

// Every level of the Fp/Fp2/Fp6/Fp12 tower accepts its own type, any level below it, and raw
// bigint/number scalars; the result of mixing two levels lives at the higher of the two. This
// generalizes what Field.multiply(someFp2) always did, in both directions.
describe("mixed-level operand normalization", function () {
  const k = new Field(3n);
  const f2 = new Fp2(5n, 7n);
  const f6 = new Fp6(new Fp2(1n, 2n), new Fp2(3n, 4n), new Fp2(5n, 6n));
  const f12 = new Fp12(
    f6,
    new Fp6(new Fp2(7n, 8n), new Fp2(9n, 10n), new Fp2(11n, 12n))
  );

  test("Fp2 accepts a Field or raw scalar where it previously threw", function () {
    const expected = new Fp2(15n, 21n);
    expect(f2.multiply(k).eq(expected)).toBeTruthy();
    expect(f2.multiply(3n).eq(expected)).toBeTruthy();
    expect(f2.multiply(3).eq(expected)).toBeTruthy();
  });

  test("scalar fast paths agree with embedding the scalar and multiplying in full", function () {
    // The shortcuts scale components directly; embedding as (k, 0, ...) and running the
    // general formula has to give the same answer or one of the two is wrong.
    expect(f2.multiply(3n).eq(f2.multiply(new Fp2(3n, 0n)))).toBeTruthy();

    const embedded6 = new Fp6(new Fp2(3n, 0n), Fp2._0, Fp2._0);
    expect(f6.multiply(3n).eq(f6.multiply(embedded6))).toBeTruthy();

    const embedded12 = new Fp12(embedded6, Fp6._0);
    expect(f12.multiply(3n).eq(f12.multiply(embedded12))).toBeTruthy();
  });

  test("multiplication commutes across levels", function () {
    expect(k.multiply(f2).eq(f2.multiply(k))).toBeTruthy();
    expect(k.multiply(f6).eq(f6.multiply(k))).toBeTruthy();
    expect(k.multiply(f12).eq(f12.multiply(k))).toBeTruthy();
    expect(f2.multiply(f6).eq(f6.multiply(f2))).toBeTruthy();
    expect(f6.multiply(f12).eq(f12.multiply(f6))).toBeTruthy();
  });

  test("add/subtract/divide round-trip with lower-level operands", function () {
    expect(f2.add(1n).subtract(1n).eq(f2)).toBeTruthy();
    expect(f6.add(k).subtract(k).eq(f6)).toBeTruthy();
    expect(f12.add(2n).subtract(2n).eq(f12)).toBeTruthy();
    expect(f2.divide(k).multiply(k).eq(f2)).toBeTruthy();
    expect(f6.divide(2n).multiply(2n).eq(f6)).toBeTruthy();
    expect(f12.divide(3n).multiply(3n).eq(f12)).toBeTruthy();
  });

  test("a lower-level receiver lifts itself to the operand's level", function () {
    // Subtraction does not commute, so this pins the orientation: k - f2 == -(f2 - k).
    expect(k.subtract(f2).eq(f2.subtract(k).negate())).toBeTruthy();
    expect(k.add(f6).eq(f6.add(k))).toBeTruthy();
    expect(k.divide(f2).eq(f2.inverse().multiply(k))).toBeTruthy();
  });

  test("unusable operands throw instead of crashing or returning undefined", function () {
    // Fp6.multiply used to fall through and silently return undefined here.
    expect(() => f6.multiply({})).toThrow(/Incorrect type argument/);
    expect(() => f2.multiply({})).toThrow(/Incorrect type argument/);
    expect(() => f2.add(null)).toThrow(/Incorrect type argument/);
    expect(() => f12.multiply(undefined)).toThrow(/Incorrect type argument/);
  });

  test("Field2/Field12 take a Field or number wherever they took a bigint", function () {
    const p = Parameters.p;
    const a = new Field2(p, 3n, 5n, false);
    const two = new Field(2n);

    expect(a.multiply(two).eq(a.multiply(2n))).toBeTruthy();
    expect(a.multiply(2).eq(a.multiply(2n))).toBeTruthy();
    expect(a.add(two).eq(a.add(2n))).toBeTruthy();
    expect(a.subtract(two).eq(a.subtract(2n))).toBeTruthy();
    expect(a.divide(two).eq(a.divide(2n))).toBeTruthy();

    const x = new Field12(Parameters, 5n);
    expect(x.multiply(two).eq(x.multiply(2n))).toBeTruthy();
    expect(x.divide(two).eq(x.divide(2n))).toBeTruthy();
    // the pre-existing Field2-scalar and Field12 paths still work
    expect(x.multiply(new Field2(p, 2n, 0n, false)).eq(x.multiply(2n))).toBeTruthy();
    expect(x.multiply(x).eq(new Field12(Parameters, 25n))).toBeTruthy();
  });
});

// The Fp2/Fp6/Fp12 tower has no p = 3 (mod 4) requirement: its Fp2 non-residue is whatever
// findQuadraticNonResidue picks for the modulus. That constraint belongs to Field2/Field12,
// which hardcode u^2 = -1 and therefore need -1 to actually be a non-residue.
describe("tower works for p = 1 (mod 4)", function () {
  const p = 10009n; // prime, = 1 (mod 4), so -1 IS a square here

  test("the fixture really is 1 (mod 4) with -1 a square", function () {
    expect(p % 4n).toEqual(1n);
    expect(jacobiSymbol((-1n).mod(p), p)).toEqual(1);
  });

  test("findQuadraticNonResidue falls back to a search instead of -1", function () {
    const nr = findQuadraticNonResidue(p);
    expect(nr).not.toEqual(p - 1n);
    expect(jacobiSymbol(nr, p)).toEqual(-1);
  });

  test("Fp2/Fp6/Fp12 all satisfy field axioms there", function () {
    const fp2Params = deriveFp2Params(p);
    const fp6Params = deriveFp6Params(fp2Params);
    const fp12Params = deriveFp12Params(fp6Params);

    const a = new Fp2(3n, 5n, fp2Params);
    const b = new Fp2(7n, 2n, fp2Params);
    expect(a.multiply(a.inverse()).eq(Fp2.one(fp2Params))).toBeTruthy();

    const a6 = new Fp6(a, b, a, fp6Params);
    expect(a6.multiply(a6.inverse()).eq(Fp6.one(fp6Params))).toBeTruthy();

    const a12 = new Fp12(a6, new Fp6(b, a, b, fp6Params), fp12Params);
    expect(a12.multiply(a12.inverse()).eq(Fp12.one(fp12Params))).toBeTruthy();
  });

  test("Field2 by contrast has zero divisors there, so it is only a ring", function () {
    // s^2 = -1 makes (s + i)(s - i) = s^2 - i^2 = 0 with neither factor zero.
    let s = null;
    for (let k = 2n; k < p; k++) {
      if ((k * k) % p === p - 1n) {
        s = k;
        break;
      }
    }
    expect(s).not.toBeNull();

    const z1 = new Field2(p, s, 1n, false);
    const z2 = new Field2(p, s, p - 1n, false);
    expect(z1.zero()).toBeFalsy();
    expect(z2.zero()).toBeFalsy();
    expect(z1.multiply(z2).zero()).toBeTruthy();
    expect(() => z1.inverse()).toThrow();
  });
});
