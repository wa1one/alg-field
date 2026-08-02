const { Field, Fp2, Fp6, Fp12, Parameters } = require("./src");

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
