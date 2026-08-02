require("./bigint-extend");

const Parameters = require("./parameters");

class Field {
  static _0 = new Field(0n);
  static _1 = new Field(1n);
  static NON_RESIDUE = new Field(
    21888242871839275222246405745257275088696311157297823662689037894645226208582n
  );

  static _2_INV = new Field(
    10944121435919637611123202872628637544348155578648911831344518947322613104292n
  );

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

  add = (o) => new Field((this.v + o.v).mod(this.p), this.p);

  multiply = (o) =>
    o instanceof Fp2
      ? new Fp2(o.a.multiply(this), o.b.multiply(this))
      : new Field((this.v * o.v).mod(this.p), this.p);

  subtract = (o) => new Field((this.v - o.v).mod(this.p), this.p);

  square = () => new Field((this.v * this.v).mod(this.p), this.p);

  double = () => new Field((this.v + this.v).mod(this.p), this.p);
  inverse = () => new Field(this.v.modInv(this.p), this.p);

  divide = (o) => new Field((this.v * o.inverse().v).mod(this.p), this.p);
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

class Fp2 {
  static _0 = new Fp2(Field._0, Field._0);
  static _1 = new Fp2(Field._1, Field._0);

  static NON_RESIDUE = new Fp2(9, 1);

  static FROBENIUS_COEFFS_B = [
    new Field(1),
    new Field(
      21888242871839275222246405745257275088696311157297823662689037894645226208582n
    ),
  ];

  constructor(a, b) {
    this.a = a instanceof Field ? a : new Field(a);
    this.b = b instanceof Field ? b : new Field(b);
  }

  square() {
    const ab = this.a.multiply(this.b);
    // ra = (a + b)(a + NON_RESIDUE * b) - ab - NON_RESIDUE * b
    const ra = this.a
      .add(this.b)
      .multiply(this.b.multiply(Field.NON_RESIDUE).add(this.a))
      .subtract(ab)
      .subtract(ab.multiply(Field.NON_RESIDUE));

    const rb = ab.double();

    return new Fp2(ra, rb);
  }

  multiply(o) {
    const aa = this.a.multiply(o.a);
    const bb = this.b.multiply(o.b);
    // ra = a1 * a2 + NON_RESIDUE * b1 * b2
    const ra = bb.multiply(Field.NON_RESIDUE).add(aa);
    // rb = (a1 + b1)(a2 + b2) - a1 * a2 - b1 * b2
    const rb = this.a
      .add(this.b)
      .multiply(o.a.add(o.b))
      .subtract(aa)
      .subtract(bb);

    return new Fp2(ra, rb);
  }

  add = (o) => new Fp2(this.a.add(o.a), this.b.add(o.b));
  subtract = (o) => new Fp2(this.a.subtract(o.a), this.b.subtract(o.b));
  double = () => this.add(this);
  divide = (o) => this.multiply(o.inverse());

  inverse() {
    const t0 = this.a.square();
    const t1 = this.b.square();
    const t2 = t0.subtract(Field.NON_RESIDUE.multiply(t1));
    const t3 = t2.inverse();

    const ra = this.a.multiply(t3);
    const rb = this.b.multiply(t3).negate();

    return new Fp2(ra, rb);
  }

  negate = () => new Fp2(this.a.negate(), this.b.negate());

  isZero = () => this.eq(Fp2._0);

  eq(o) {
    if (!(o instanceof Fp2)) return false;

    if (this.a != null ? !this.a.eq(o.a) : o.a != null) return false;
    return !(this.b != null ? !this.b.eq(o.b) : o.b != null);
  }

  frobeniusMap(power) {
    const ra = this.a;
    const rb = Fp2.FROBENIUS_COEFFS_B[power % 2n].multiply(this.b);

    return new Fp2(ra, rb);
  }

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

class Fp6 {
  static _0 = new Fp6(Fp2._0, Fp2._0, Fp2._0);
  static _1 = new Fp6(Fp2._1, Fp2._0, Fp2._0);

  static NON_RESIDUE = new Fp2(9, 1);

  constructor(a, b, c) {
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

    const ra = s0.add(s3.mulByNonResidue());
    const rb = s1.add(s4.mulByNonResidue());
    const rc = s1.add(s2).add(s3).subtract(s0).subtract(s4);

    return new Fp6(ra, rb, rc);
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
        b1
          .add(c1)
          .multiply(b2.add(c2))
          .subtract(b1b2)
          .subtract(c1c2)
          .mulByNonResidue()
      );
      const rb = a1
        .add(b1)
        .multiply(a2.add(b2))
        .subtract(a1a2)
        .subtract(b1b2)
        .add(c1c2.mulByNonResidue());
      const rc = a1
        .add(c1)
        .multiply(a2.add(c2))
        .subtract(a1a2)
        .add(b1b2)
        .subtract(c1c2);

      return new Fp6(ra, rb, rc);
    }
    if (o instanceof Fp2) {
      const ra = this.a.multiply(o);
      const rb = this.b.multiply(o);
      const rc = this.c.multiply(o);

      return new Fp6(ra, rb, rc);
    }
  }

  mulByNonResidue() {
    const ra = Fp6.NON_RESIDUE.multiply(this.c);
    const rb = this.a;
    const rc = this.b;

    return new Fp6(ra, rb, rc);
  }

  add(o) {
    const ra = this.a.add(o.a);
    const rb = this.b.add(o.b);
    const rc = this.c.add(o.c);

    return new Fp6(ra, rb, rc);
  }

  subtract(o) {
    const ra = this.a.subtract(o.a);
    const rb = this.b.subtract(o.b);
    const rc = this.c.subtract(o.c);

    return new Fp6(ra, rb, rc);
  }

  inverse() {
    const t0 = this.a.square();
    const t1 = this.b.square();
    const t2 = this.c.square();
    const t3 = this.a.multiply(this.b);
    const t4 = this.a.multiply(this.c);
    const t5 = this.b.multiply(this.c);
    const c0 = t0.subtract(t5.mulByNonResidue());
    const c1 = t2.mulByNonResidue().subtract(t3);
    const c2 = t1.subtract(t4);
    const t6 = this.a
      .multiply(c0)
      .add(this.c.multiply(c1).add(this.b.multiply(c2)).mulByNonResidue())
      .inverse();

    const ra = t6.multiply(c0);
    const rb = t6.multiply(c1);
    const rc = t6.multiply(c2);

    return new Fp6(ra, rb, rc);
  }

  negate = () => new Fp6(this.a.negate(), this.b.negate(), this.c.negate());

  isZero = () => this.eq(Fp6._0);

  frobeniusMap(power) {
    const ra = this.a.frobeniusMap(power);
    const rb = Fp6.FROBENIUS_COEFFS_B[power % 6n].multiply(
      this.b.frobeniusMap(power)
    );
    const rc = Fp6.FROBENIUS_COEFFS_C[power % 6n].multiply(
      this.c.frobeniusMap(power)
    );

    return new Fp6(ra, rb, rc);
  }

  eq(fp6) {
    if (!(fp6 instanceof Fp6)) return false;

    if (this.a != null ? !this.a.eq(fp6.a) : fp6.a != null) return false;
    if (this.b != null ? !this.b.eq(fp6.b) : fp6.b != null) return false;
    return !(this.c != null ? !this.c.eq(fp6.c) : fp6.c != null);
  }

  divide = (o) => this.multiply(o.inverse());

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

  static FROBENIUS_COEFFS_B = [
    Fp2._1,
    new Fp2(
      21575463638280843010398324269430826099269044274347216827212613867836435027261n,
      10307601595873709700152284273816112264069230130616436755625194854815875713954n
    ),
    new Fp2(
      21888242871839275220042445260109153167277707414472061641714758635765020556616n,
      0
    ),
    new Fp2(
      3772000881919853776433695186713858239009073593817195771773381919316419345261n,
      2236595495967245188281701248203181795121068902605861227855261137820944008926n
    ),
    new Fp2(2203960485148121921418603742825762020974279258880205651966n, 0),
    new Fp2(
      18429021223477853657660792034369865839114504446431234726392080002137598044644n,
      9344045779998320333812420223237981029506012124075525679208581902008406485703n
    ),
  ];

  static FROBENIUS_COEFFS_C = [
    Fp2._1,
    new Fp2(
      2581911344467009335267311115468803099551665605076196740867805258568234346338n,
      19937756971775647987995932169929341994314640652964949448313374472400716661030n
    ),
    new Fp2(2203960485148121921418603742825762020974279258880205651966n, 0),
    new Fp2(
      5324479202449903542726783395506214481928257762400643279780343368557297135718n,
      16208900380737693084919495127334387981393726419856888799917914180988844123039n
    ),
    new Fp2(
      21888242871839275220042445260109153167277707414472061641714758635765020556616n,
      0
    ),
    new Fp2(
      13981852324922362344252311234282257507216387789820983642040889267519694726527n,
      7629828391165209371577384193250820201684255241773809077146787135900891633097n
    ),
  ];
}

class Fp12 {
  static _0 = new Fp12(Fp6._0, Fp6._0);
  static _1 = new Fp12(Fp6._1, Fp6._0);

  static FROBENIUS_COEFFS_B = [
    new Fp2(1, 0),
    new Fp2(
      8376118865763821496583973867626364092589906065868298776909617916018768340080n,
      16469823323077808223889137241176536799009286646108169935659301613961712198316n
    ),
    new Fp2(
      21888242871839275220042445260109153167277707414472061641714758635765020556617n,
      0n
    ),
    new Fp2(
      11697423496358154304825782922584725312912383441159505038794027105778954184319n,
      303847389135065887422783454877609941456349188919719272345083954437860409601n
    ),
    new Fp2(
      21888242871839275220042445260109153167277707414472061641714758635765020556616n,
      0
    ),
    new Fp2(
      3321304630594332808241809054958361220322477375291206261884409189760185844239n,

      5722266937896532885780051958958348231143373700109372999374820235121374419868n
    ),
    new Fp2(
      21888242871839275222246405745257275088696311157297823662689037894645226208582n,
      0
    ),
    new Fp2(
      13512124006075453725662431877630910996106405091429524885779419978626457868503n,
      5418419548761466998357268504080738289687024511189653727029736280683514010267n
    ),
    new Fp2(2203960485148121921418603742825762020974279258880205651966n, 0),
    new Fp2(
      10190819375481120917420622822672549775783927716138318623895010788866272024264n,

      21584395482704209334823622290379665147239961968378104390343953940207365798982n
    ),
    new Fp2(2203960485148121921418603742825762020974279258880205651967n, 0),
    new Fp2(
      18566938241244942414004596690298913868373833782006617400804628704885040364344n,
      16165975933942742336466353786298926857552937457188450663314217659523851788715n
    ),
  ];

  constructor(a, b) {
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

    return new Fp12(ra, rb);
  }

  double() {
    return this.add(this);
  }

  mulBy024(ell0, ellVW, ellVV) {
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
    let t4 = Fp6.NON_RESIDUE.multiply(t3).add(d0);
    z0 = t4;

    // For z.a_.b_ = z1
    t3 = z5.multiply(x4);
    s1 = s1.add(t3);
    t3 = t3.add(d2);
    t4 = Fp6.NON_RESIDUE.multiply(t3);
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
    t4 = Fp6.NON_RESIDUE.multiply(t3);
    t3 = z3.multiply(x0);
    s1 = s1.add(t3);
    t4 = t4.add(t3);
    z3 = t4;

    // For z.b_.b_ = z4
    t3 = z5.multiply(x2);
    s1 = s1.add(t3);
    t4 = Fp6.NON_RESIDUE.multiply(t3);
    t0 = x0.add(x4);
    t3 = t2.multiply(t0).subtract(d0).subtract(d4);
    t4 = t4.add(t3);
    z4 = t4;

    // For z.b_.c_ = z5.
    t0 = x0.add(x2).add(x4);
    t3 = s0.multiply(t0).subtract(s1);
    z5 = t3;

    return new Fp12(new Fp6(z0, z1, z2), new Fp6(z3, z4, z5));
  }

  add = (o) => new Fp12(this.a.add(o.a), this.b.add(o.b));

  divide = (o) => this.multiply(o.inverse());

  multiply(o) {
    const a2 = o.a,
      b2 = o.b;
    const a1 = this.a,
      b1 = this.b;

    const a1a2 = a1.multiply(a2);
    const b1b2 = b1.multiply(b2);

    const ra = a1a2.add(b1b2.mulByNonResidue());
    const rb = a1.add(b1).multiply(a2.add(b2)).subtract(a1a2).subtract(b1b2);

    return new Fp12(ra, rb);
  }

  subtract = (o) => new Fp12(this.a.subtract(o.a), this.b.subtract(o.b));

  inverse() {
    const t0 = this.a.square();
    const t1 = this.b.square();
    const t2 = t0.subtract(t1.mulByNonResidue());
    const t3 = t2.inverse();

    return new Fp12(this.a.multiply(t3), this.b.multiply(t3).negate());
  }

  negate = () => new Fp12(this.a.negate(), this.b.negate());

  isZero = () => this.eq(Fp12._0);

  frobeniusMap(power) {
    const ra = this.a.frobeniusMap(power);
    const rb = this.b
      .frobeniusMap(power)
      .multiply(Fp12.FROBENIUS_COEFFS_B[power % 12n]);

    return new Fp12(ra, rb);
  }

  cyclotomicSquared() {
    let z0 = this.a.a;
    let z4 = this.a.b;
    let z3 = this.a.c;
    let z2 = this.b.a;
    let z1 = this.b.b;
    let z5 = this.b.c;

    let tmp = z0.multiply(z1);
    const t0 = z0
      .add(z1)
      .multiply(z0.add(Fp6.NON_RESIDUE.multiply(z1)))
      .subtract(tmp)
      .subtract(Fp6.NON_RESIDUE.multiply(tmp));
    const t1 = tmp.add(tmp);
    // t2 + t3*y = (z2 + z3*y)^2 = b^2
    tmp = z2.multiply(z3);
    const t2 = z2
      .add(z3)
      .multiply(z2.add(Fp6.NON_RESIDUE.multiply(z3)))
      .subtract(tmp)
      .subtract(Fp6.NON_RESIDUE.multiply(tmp));
    const t3 = tmp.add(tmp);
    // t4 + t5*y = (z4 + z5*y)^2 = c^2
    tmp = z4.multiply(z5);
    const t4 = z4
      .add(z5)
      .multiply(z4.add(Fp6.NON_RESIDUE.multiply(z5)))
      .subtract(tmp)
      .subtract(Fp6.NON_RESIDUE.multiply(tmp));
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
    tmp = Fp6.NON_RESIDUE.multiply(t5);
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

    return new Fp12(new Fp6(z0, z4, z3), new Fp6(z2, z1, z5));
  }

  cyclotomicExp(pow) {
    if (typeof pow !== "bigint") pow = BigInt(pow);
    let res = Fp12._1;

    for (let i = pow.bitLength() - 1; i >= 0; i--) {
      res = res.cyclotomicSquared();

      if (pow.testBit(i)) {
        res = res.multiply(this);
      }
    }

    return res;
  }

  unitaryInverse = () => new Fp12(this.a, this.b.negate());

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
    if (typeof v === "bigint") {
      return new Field2(this.p, (this.re + v).mod(this.p), this.im, false);
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
    if (typeof v === "bigint") {
      return new Field2(this.p, (this.re - v).mod(this.p), this.im, false);
    }
    throw new Error("Incorrect type argument");
  }

  multiply(v) {
    if (v instanceof Field2) {
      const re = (this.re * v.re - this.im * v.im).mod(this.p);
      const im = (this.re * v.im + this.im * v.re).mod(this.p);
      return new Field2(this.p, re, im, false);
    }
    if (typeof v === "bigint") {
      return new Field2(
        this.p,
        (this.re * v).mod(this.p),
        (this.im * v).mod(this.p),
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
    if (typeof v === "bigint") {
      return this.multiply(new Field2(this.p, v).inverse());
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

function fp2FindNonResidue(p, exponent, one) {
  for (let re = 1n; re < 50n; re++) {
    for (let im = 0n; im < 50n; im++) {
      const candidate = new Field2(p, re, im, false);
      if (!candidate.exp(exponent).eq(one)) return candidate;
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

  const nonResidue = fp2FindNonResidue(p, (q - 1n) / r, one);
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

// Field12 represents Fp12 directly as Fp[x]/(x^12 - 18x^6 + 82) - the standard BN254 FQ12
// modulus polynomial (as used by e.g. py_ecc's optimized_bn128) - rather than as the
// Fp2/Fp6/Fp12 tower built above. Elements are stored packed as 6 Field2 pairs (this.v),
// which is how add/subtract/negate/scalar-multiply operate directly; the full Field12
// multiply/inverse unpack to the 12 flat Fp coefficients (via split()/join()) to do the
// polynomial arithmetic, mirroring that reference implementation.
//
// `bn` is any {p, n} pair of curve parameters (Parameters from this package satisfies this
// shape directly); `p` must be the same modulus used to build the Field2 coefficients.
const FIELD12_DEGREE = 12;
const FIELD12_MODULUS_COEFFS = [82n, 0n, 0n, 0n, 0n, 0n, -18n, 0n, 0n, 0n, 0n, 0n];

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

function field12PolyMultiply(a, b, p) {
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
        result[exp + i] - (top * FIELD12_MODULUS_COEFFS[i]).mod(p)
      ).mod(p);
    }
  }
  return result;
}

function field12PolyInverse(aCoeffs, p) {
  let lm = [1n, ...new Array(FIELD12_DEGREE).fill(0n)];
  let hm = new Array(FIELD12_DEGREE + 1).fill(0n);
  let low = [...aCoeffs, 0n];
  let high = [...FIELD12_MODULUS_COEFFS, 1n];

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
    if (typeof k === "bigint" || k instanceof Field2) {
      return new Field12(
        this.bn,
        this.v.map((c) => c.divide(k))
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
    if (typeof k === "bigint" || k instanceof Field2) {
      return new Field12(
        this.bn,
        this.v.map((c) => c.multiply(k))
      );
    }
    if (k instanceof Field12) {
      if (this.bn.p !== k.bn.p) {
        throw new Error("Operands are in different finite fields");
      }
      if (this.one()) return k;
      if (k.one()) return this;
      if (this.zero() || k.zero()) return new Field12(this.bn, 0n);

      const product = field12PolyMultiply(this.split(), k.split(), this.bn.p);
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
    const inv = field12PolyInverse(this.split(), this.bn.p);
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

module.exports = { Field, Fp2, Fp6, Fp12, Field2, Field12, Parameters };
