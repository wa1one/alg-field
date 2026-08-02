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

/* eslint-disable no-undef, no-const-assign -- Field2/Field12 are an unfinished port from another
   BigInteger-style library (bigInt.isInstance, compareTo, shiftLeft, etc.) and are non-functional
   as shipped; left disabled here pending a real rewrite rather than papered over line by line. */
class Field2 {
  constructor(p, re, im, reduce) {
    this.poly_coeffs = [1, 0];
    this.degree = this.poly_coeffs.length;
    if (arguments.length === 1) {
      this.p = p;
      this.re = _0;
      this.im = _0;
    }
    if (arguments.length === 2) {
      if (typeof re === "bigint") {
        this.p = p;
        this.re = re; //no  reduction!!!//
        this.im = _0;
      }
      /*else if (re instanceof CryptoRandom) {
        this.p = p;
        const rand = re;
        do {
          this.re = ExNumber.construct(this.p.bitLength(), rand);
        } while (this.re.compareTo(this.p) >= 0);
        do {
          this.im = ExNumber.construct(this.p.bitLength(), rand);
        } while (this.im.compareTo(this.p) >= 0);
      }*/
    }
    if (arguments.length === 4) {
      this.p = p;
      if (reduce) {
        this.re = re.toZn(this.p);
        this.im = im.toZn(this.p);
      } else {
        this.re = re;
        this.im = im;
      }
    }
  }

  zero = () => this.re.isZero() && this.im.isZero();

  one = () => this.re.compareTo(_1) === 0 && this.im.isZero();

  eq = (u) =>
    !(u instanceof Field2)
      ? false
      : this.re.equals(u.re) && this.im.equals(u.im);

  neg = () =>
    new Field2(
      this.p,
      !this.re.isZero() ? this.p.subtract(this.re) : this.re,
      !this.im.isZero() ? this.p.subtract(this.im) : this.im,
      false
    );

  add(v) {
    if (v instanceof Field2) {
      if (!this.p.eq(v.p)) {
        throw new Error("Operands are in different finite fields");
      }
      const r = this.re.add(v.re);

      if (r.compareTo(this.p) >= 0) {
        r = r.subtract(this.p);
      }
      const i = this.im.add(v.im);

      if (i.compareTo(this.p) >= 0) {
        i = i.subtract(this.p);
      }
      return new Field2(this.p, r, i, false);
    }
    if (bigInt.isInstance(v)) {
      const s = this.re.add(v);

      if (s.compareTo(this.p) >= 0) {
        s = s.subtract(this.p);
      }
      return new Field2(this.p, s, this.im, false);
    }
  }

  subtract(v) {
    if (v instanceof Field2) {
      if (this.p !== v.p) {
        throw new Error("Operands are in different finite fields");
      }
      const r = this.re.subtract(v.re);

      if (r.isNegative()) {
        r = r.add(this.p);
      }
      const i = this.im.subtract(v.im);

      if (i.isNegative()) {
        i = i.add(this.p);
      }
      return new Field2(this.p, r, i, false);
    }
    if (bigInt.isInstance(v)) {
      const r = this.re.subtract(v);
      if (r.isNegative()) {
        r = r.add(this.p);
      }
      return new Field2(this.p, r, this.im, false);
    }
  }

  twice(k) {
    const r = this.re;
    const i = this.im;
    while (k-- > 0) {
      r = r.shiftLeft(1);
      if (r.compareTo(this.p) >= 0) {
        r = r.subtract(this.p);
      }
      i = i.shiftLeft(1);
      if (i.compareTo(this.p) >= 0) {
        i = i.subtract(this.p);
      }
    }
    return new Field2(this.p, r, i, false);
  }

  halve = () =>
    new Field2(
      this.p,
      (this.re.and(1) != 0 ? this.re.add(this.p) : this.re).shiftRight(1),
      (this.im.and(1) != 0 ? this.im.add(this.p) : this.im).shiftRight(1),
      false
    );

  divide(v) {
    if (v instanceof Field2) {
      return this.multiply(v.inverse());
    }
    if (bigInt.isInstance(v)) {
      const nr = this.re.multiply(v.modInv(this.p));
      const ni = this.im.multiply(v.modInv(this.p));
      return new Field2(this.p, nr, ni, true);
    }
    return null;
  }

  inverse() {
    const d = this.re
      .multiply(this.re)
      .add(this.im.multiply(this.im))
      .modInv(this.p);
    return new Field2(
      this.p,
      this.re.multiply(d),
      this.p.subtract(this.im).multiply(d),
      true
    );
  }

  multiply(v) {
    if (v instanceof Field2) {
      if (this === v) {
        return this.square();
      }
      if (this.bn !== v.bn) {
        throw new Error("Operands are in different finite fields");
      }
      if (this.one() || v.zero()) {
        return v;
      }
      if (this.zero() || v.one()) {
        return this;
      }

      const re2 = this.re.multiply(v.re);
      const im2 = this.im.multiply(v.im);
      const mix = this.re.add(this.im).multiply(v.re.add(v.im));

      return new Field2(
        this.p,
        re2.subtract(im2),
        mix.subtract(re2).subtract(im2),
        true
      );
    }
    if (bigInt.isInstance(v)) {
      return new Field2(this.p, this.re.multiply(v), this.im.multiply(v), true);
    }
    if (v instanceof Number) {
      const newre = this.re.multiply(v.toString());
      while (newre.isNegative()) {
        newre = newre.add(this.p);
      }
      while (newre.compareTo(this.p) >= 0) {
        newre = newre.subtract(this.p);
      }
      const newim = this.im.multiply(v);
      while (newim.isNegative()) {
        newim = newim.add(this.p);
      }
      while (newim.compareTo(this.p) >= 0) {
        newim = newim.subtract(this.p);
      }
      return new Field2(this.p, newre, newim, false);
    }
    throw new Error("Incorrect type argument");
  }

  square() {
    if (this.zero() || this.one()) {
      return this;
    }
    if (this.im.isZero()) {
      return new Field2(this.p, this.re.multiply(this.re), _0, true);
    }
    if (this.re.isZero()) {
      return new Field2(this.p, this.im.multiply(this.im).negate(), _0, true);
    }

    return new Field2(
      this.p,
      this.re.add(this.im).multiply(this.re.subtract(this.im)),
      this.re.multiply(this.im).shiftLeft(1),
      true
    );
  }

  cube() {
    const re2 = this.re.multiply(this.re);
    const im2 = this.im.multiply(this.im);
    return new Field2(
      this.p,
      this.re.multiply(re2.subtract(im2.add(im2).add(im2))),
      this.im.multiply(re2.add(re2).add(re2).subtract(im2)),
      true
    );
  }

  mulI = () =>
    new Field2(
      this.p,
      !this.im.isZero() ? this.p.subtract(this.im) : this.im,
      this.re,
      false
    );

  divideI = () =>
    new Field2(
      this.p,
      this.im,
      !this.re.isZero() ? this.p.subtract(this.re) : this.re,
      false
    );

  mulV() {
    const r = this.re.subtract(this.im);
    if (r.isNegative()) {
      r = r.add(this.p);
    }
    const i = this.re.add(this.im);
    if (i.compareTo(this.p) >= 0) {
      i = i.subtract(this.p);
    }
    return new Field2(this.p, r, i, false);
  }

  divV() {
    const qre = this.re.add(this.im);
    if (qre.compareTo(this.p) >= 0) {
      qre = qre.subtract(this.p);
    }
    const qim = this.im.subtract(this.re);
    if (qim.isNegative()) {
      qim = qim.add(this.p);
    }
    return new Field2(
      this.p,
      (qre.testBit(0) ? qre.add(this.p) : qre).shiftRight(1),
      (qim.testBit(0) ? qim.add(this.p) : qim).shiftRight(1),
      false
    );
  }

  exp(k) {
    const P = this;
    if (k.isNegative()) {
      k = k.neg();
      P = P.inverse();
    }
    const e = k.toArray(256).value;

    const mP = new Array(16);
    mP[0] = new Field2(this.p, 1);
    mP[1] = P;
    for (let m = 1; m <= 7; m++) {
      mP[2 * m] = mP[m].square();
      mP[2 * m + 1] = mP[2 * m].multiply(P);
    }
    let A = mP[0];
    for (let i = 0; i < e.length; i++) {
      let u = e[i] & 0xff;
      A = A.square()
        .square()
        .square()
        .square()
        .multiply(mP[u >>> 4])
        .square()
        .square()
        .square()
        .square()
        .multiply(mP[u & 0xf]);
    }
    return A;
  }

  sqrt() {
    if (this.zero()) {
      return this;
    }

    const r = this.exp(this.p.multiply(this.p).add(7).divide(16));
    const r2 = r.square();
    if (r2.subtract(this).zero()) {
      return r;
    }
    if (r2.add(this).zero()) {
      return r.mulI();
    }
    r2 = r2.mulI();

    const invSqrtMinus2 = this.p
      .subtract(2)
      .modPow(this.p.subtract(_1).subtract(this.p.add(`_1`).divide(4)), this.p); // 1/sqrt(-2) = (-2)^{-(p+1)/4}
    const sqrtI = new Field2(
      this.p,
      invSqrtMinus2,
      this.p.subtract(invSqrtMinus2),
      false
    ); // sqrt(i) = (1 - i)/sqrt(-2)

    r = r.multiply(sqrtI);
    if (r2.subtract(this).zero()) {
      return r;
    }
    if (r2.add(this).zero()) {
      return r.mulI();
    }

    return null;
  }

  cbrt() {
    if (this.zero()) {
      return this;
    }
    const r = this.exp(bn.cbrtExponent2);
    return r.cube().subtract(this).zero() ? r : null;
  }

  toString = () => "[" + this.re.toString() + "," + this.im.toString() + "]";
}

class Field12 {
  constructor(bn, k) {
    this.poly_coeffs = [82n, 0, 0, 0, 0, 0, -18n, 0, 0, 0, 0, 0];
    this.degree = this.poly_coeffs.length;

    if (arguments.length === 1) {
      const f = bn;
      this.bn = f.bn;
      this.v = new Array(6);
      for (let i = 0; i < 6; i++) {
        this.v[i] = f.v[i];
      }
    }
    if (arguments.length === 2) {
      if (bigInt.isInstance(k)) {
        this.bn = bn;
        this.v = new Array(6);
        this.v[0] = new Field2(bn.p, k);
        for (let i = 1; i < 6; i++) {
          this.v[i] = new Field2(bn.p);
        }
      } else if (k instanceof Array) {
        this.bn = bn;
        this.v = k;
      } else {
        this.bn = bn;
        this.v = new Array(6);
        for (let i = 0; i < 6; i++) {
          this.v[i] = new Field2(bn.p, k);
        }
      }
    }
  }

  zero = () =>
    this.v[0].zero() &&
    this.v[1].zero() &&
    this.v[2].zero() &&
    this.v[3].zero() &&
    this.v[4].zero() &&
    this.v[5].zero();

  one = () =>
    this.v[0].one() &&
    this.v[1].zero() &&
    this.v[2].zero() &&
    this.v[3].zero() &&
    this.v[4].zero() &&
    this.v[5].zero();

  eq = (o) =>
    o instanceof Field12
      ? this.v[0].eq(o.v[0]) &&
        this.v[1].eq(o.v[1]) &&
        this.v[2].eq(o.v[2]) &&
        this.v[3].eq(o.v[3]) &&
        this.v[4].eq(o.v[4]) &&
        this.v[5].eq(o.v[5])
      : false;

  neg() {
    const w = new Array(6);
    for (let i = 0; i < 6; i++) {
      w[i] = this.v[i].neg();
    }
    return new Field12(this.bn, w);
  }

  add(k) {
    if (this.bn.p !== k.bn.p) {
      throw new Error("Operands are in different finite fields");
    }
    const w = new Array(6);
    for (let i = 0; i < 6; i++) {
      w[i] = this.v[i].add(k.v[i]);
    }
    return new Field12(this.bn, w);
  }

  subtract(k) {
    if (this.bn.p !== k.bn.p) {
      throw new Error("Operands are in different finite fields");
    }
    const w = new Array(6);
    for (let i = 0; i < 6; i++) {
      w[i] = this.v[i].subtract(k.v[i]);
    }
    return new Field12(this.bn, w);
  }

  divide(k) {
    if (bigInt.isInstance(k) || k instanceof Field2) {
      const w = new Array(6);
      for (let i = 0; i < 6; i++) {
        w[i] = this.v[i].divide(k);
      }
      return new Field12(this.bn, w);
    }
    if (k instanceof Field12) {
      return this.multiply(k.inverse());
    }
  }

  split() {
    this.s = [
      new Field2(this.bn.p, this.v[0].re),
      new Field2(this.bn.p, this.v[0].im),
      new Field2(this.bn.p, this.v[1].re),
      new Field2(this.bn.p, this.v[1].im),
      new Field2(this.bn.p, this.v[2].re),
      new Field2(this.bn.p, this.v[2].im),
      new Field2(this.bn.p, this.v[3].re),
      new Field2(this.bn.p, this.v[3].im),
      new Field2(this.bn.p, this.v[4].re),
      new Field2(this.bn.p, this.v[4].im),
      new Field2(this.bn.p, this.v[5].re),
      new Field2(this.bn.p, this.v[5].im),
    ];
  }

  join(s) {
    const ar = new Array(6);

    for (let i = 0; i < ar.length; i++) {
      ar[i] = new Field2(this.bn.p, s[i * 2].re, s[i * 2 + 1].re, false);
    }

    return new Field12(this.bn, ar);
  }

  multiply(k) {
    if (bigInt.isInstance(k) || k instanceof Field2) {
      const w = new Array(6);
      for (let i = 0; i < 6; i++) {
        w[i] = this.v[i].multiply(k);
      }
      return new Field12(this.bn, w);
    }
    if (k instanceof Field12) {
      if (!this.bn.p.equals(k.bn.p)) {
        throw new Error("Operands are in different finite fields");
      }
      if (this.one() || k.zero()) {
        return k;
      }
      if (this.zero() || k.one()) {
        return this;
      }

      const b = new Array(this.degree * 2 - 1).fill(new Field2(this.bn.p, _0));

      this.split();
      k.split();

      for (let i = 0; i < this.degree; i++) {
        for (let j = 0; j < this.degree; j++) {
          b[i + j] = b[i + j].add(this.s[i].multiply(k.s[j]));
        }
      }

      while (b.length > this.degree) {
        const exp = b.length - this.degree - 1;
        const top = b.pop();
        for (let i = 0; i < this.degree; i++) {
          b[exp + i] = b[exp + i].subtract(top.multiply(this.poly_coeffs[i]));
        }
      }

      return this.join(b);
    }
  }

  mulV = () =>
    new Field12(this.bn, [
      this.v[4].mulV(),
      this.v[5].mulV(),
      this.v[0],
      this.v[1],
      this.v[2],
      this.v[3],
    ]);

  divV = () =>
    new Field12(this.bn, [
      this.v[4].divV(),
      this.v[5].divV(),
      this.v[0],
      this.v[1],
      this.v[2],
      this.v[3],
    ]);

  inverse() {
    const deg = (p) => {
      const d = p.length - 1;
      while (p[d].eq(new Field2(this.bn.p, _0)) && d > 0) d -= 1;
      return d;
    };

    const poly_div = (a, b) => {
      const dega = deg(a);
      const degb = deg(b);
      const temp = a.slice();
      const o = new Array(a.length).fill(new Field2(this.bn.p, _0));
      for (let i = dega - degb; i > -1; i--) {
        o[i] = o[i].add(temp[degb + i].divide(b[degb]));
        for (let c = 0; c < degb + 1; c++) {
          temp[c + i] = temp[c + i].subtract(o[c]);
        }
      }
      return o.slice(0, deg(o) + 1);
    };

    const lm = new Array(this.degree + 1).fill(new Field2(this.bn.p, _0));
    lm[0] = new Field2(this.bn.p, _1);
    const hm = new Array(this.degree + 1).fill(new Field2(this.bn.p, _0));
    this.split();
    const low = this.s.slice();
    low.push(new Field2(this.bn.p, _0));
    const high = this.poly_coeffs.map((e) => new Field2(this.bn.p, e)).slice();
    high.push(new Field2(this.bn.p, _1));

    while (deg(low)) {
      let r = poly_div(high, low);
      r = r.concat(
        new Array(this.degree + 1 - r.length).fill(new Field2(this.bn.p, _0))
      );

      const nm = hm.slice();
      const neww = high.slice();

      for (let i = 0; i < this.degree + 1; i++) {
        for (let j = 0; j < this.degree + 1 - i; j++) {
          nm[i + j] = nm[i + j].subtract(lm[i].multiply(r[j]));
          neww[i + j] = neww[i + j].subtract(low[i].multiply(r[j]));
        }
      }

      lm = nm.slice();
      low = neww.slice();
      hm = lm.slice();
      high = low.slice();
    }

    return this.join(lm.slice(0, this.degree)).divide(low[0].re);
  }

  exp(k) {
    let w = this;
    const st = bigInt(k).bitLength() - 2;
    for (let i = st; i >= 0; i--) {
      w = w.multiply(w);
      if (k.testBit(i)) {
        w = w.multiply(this);
      }
    }
    return w;
  }

  finExp = () => this.exp(this.bn.p.pow(12).subtract(_1).divide(this.bn.n));

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
/* eslint-enable no-undef, no-const-assign */

module.exports = { Field, Fp2, Fp6, Fp12, Field2, Field12, Parameters };
