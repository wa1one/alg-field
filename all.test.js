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
