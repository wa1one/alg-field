BigInt.prototype.modInv = function (p) {
  function eGcd(a, b) {
    a = BigInt(a);
    b = BigInt(b);
    if ((a <= 0n) | (b <= 0n)) throw new RangeError("a and b MUST be > 0");

    let x = 0n;
    let y = 1n;
    let u = 1n;
    let v = 0n;

    while (a !== 0n) {
      const q = b / a;
      const r = b % a;
      const m = x - u * q;
      const n = y - v * q;
      b = a;
      a = r;
      x = u;
      y = v;
      u = m;
      v = n;
    }
    return {
      g: b,
      x: x,
      y: y,
    };
  }

  const egcd = eGcd(this.toZn(p), p);
  if (egcd.g !== 1n) {
    throw new RangeError(
      `${this.toString()} does not have inverse modulo ${p.toString()}`,
    );
  }
  return egcd.x.toZn(p);
};

BigInt.prototype.toZn = function (p) {
  p = BigInt(p);
  if (p <= 0) {
    return NaN;
  }

  const a = BigInt(this) % p;
  return a < 0 ? a + p : a;
};

BigInt.prototype.bitLength = function () {
  let a = BigInt(this);
  if (a === 1n) {
    return 1;
  }
  let bits = 1;
  do {
    bits++;
  } while ((a >>= 1n) > 1n);
  return bits;
};

BigInt.prototype.mod = function (p) {
  const a = this % p;
  return a < 0n ? a + p : a;
};

BigInt.prototype.testBit = function (n) {
  return Boolean(this & (1n << BigInt(n)));
};
