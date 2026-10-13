// Proves that H = Poseidon2(domain, NRIC/FIN, mobile) was computed from the
// singpass_id and mobile_number that TLSNotary hash-committed from Singpass's
// profile response, without revealing either.
//
// TLSNotary commits a JSON field as SHA256(key-value bytes || 16-byte blinder),
// where the key-value bytes are exactly `"singpass_id":"S1234567D"` and
// `"mobile_number":"91234567"` in Singpass's compact JSON. The verifier
// authenticates those commitments against the TLS session; this circuit opens
// them privately and derives H. The issuer then keys H (HMAC) as the person id.

global BLINDER_LEN: u32 = 16;
global ID_KV_LEN: u32 = 25; // "singpass_id":"S1234567D"
global PHONE_KV_LEN: u32 = 26; // "mobile_number":"91234567"
global ID_PREFIX: [u8; 15] = "\"singpass_id\":\"".as_bytes();
global PHONE_PREFIX: [u8; 17] = "\"mobile_number\":\"".as_bytes();
// Separates these hashes from any other use of Poseidon2 over similar inputs.
global DOMAIN: Field = 0x7a6b2d73696e67706173732d706572736f6e2d7631; // "zk-singpass-person-v1"

fn main(
    id_kv: [u8; ID_KV_LEN],
    id_blinder: [u8; BLINDER_LEN],
    phone_kv: [u8; PHONE_KV_LEN],
    phone_blinder: [u8; BLINDER_LEN],
    id_commitment: pub [u8; 32],
    phone_commitment: pub [u8; 32],
) -> pub Field {
    assert(sha256::digest(concat(id_kv, id_blinder)) == id_commitment, "singpass_id commitment mismatch");
    assert(sha256::digest(concat(phone_kv, phone_blinder)) == phone_commitment, "mobile_number commitment mismatch");

    let nric = nric_value(id_kv);
    let phone = phone_value(phone_kv);
    poseidon::poseidon2::Poseidon2::hash([DOMAIN, nric, phone], 3)
}

/// NRIC/FIN `[STFGM]` + 7 digits + `[A-Z]`, packed big-endian into a Field.
fn nric_value(kv: [u8; ID_KV_LEN]) -> Field {
    check_prefix(kv, ID_PREFIX);
    assert(kv[ID_KV_LEN - 1] == 34, "singpass_id must end with a quote");
    let first = kv[15];
    assert((first == 83) | (first == 84) | (first == 70) | (first == 71) | (first == 77), "bad NRIC prefix");
    let mut value: Field = 0;
    for i in 15..24 {
        let c = kv[i];
        if (i > 15) & (i < 23) {
            assert((c >= 48) & (c <= 57), "NRIC digits");
        }
        value = value * 256 + c as Field;
    }
    let last = kv[23];
    assert((last >= 65) & (last <= 90), "NRIC check letter");
    value
}

/// Singapore mobile: 8 digits starting with 8 or 9, as an integer.
fn phone_value(kv: [u8; PHONE_KV_LEN]) -> Field {
    check_prefix(kv, PHONE_PREFIX);
    assert(kv[PHONE_KV_LEN - 1] == 34, "mobile_number must end with a quote");
    assert((kv[17] == 56) | (kv[17] == 57), "mobile must start with 8 or 9");
    let mut value: Field = 0;
    for i in 17..25 {
        let c = kv[i];
        assert((c >= 48) & (c <= 57), "mobile digits");
        value = value * 10 + (c - 48) as Field;
    }
    value
}

fn check_prefix<let N: u32, let P: u32>(kv: [u8; N], prefix: [u8; P]) {
    for i in 0..P {
        assert(kv[i] == prefix[i], "unexpected field");
    }
}

fn concat<let A: u32, let B: u32>(a: [u8; A], b: [u8; B]) -> [u8; A + B] {
    let mut out = [0; A + B];
    for i in 0..A {
        out[i] = a[i];
    }
    for i in 0..B {
        out[A + i] = b[i];
    }
    out
}

#[test]
fn accepts_matching_commitments() {
    let id_kv = "\"singpass_id\":\"S1234567D\"".as_bytes();
    let phone_kv = "\"mobile_number\":\"91234567\"".as_bytes();
    let b1 = [1; 16];
    let b2 = [2; 16];
    let h = main(id_kv, b1, phone_kv, b2, sha256::digest(concat(id_kv, b1)), sha256::digest(concat(phone_kv, b2)));
    // Same person and phone always give the same H; a different phone doesn't.
    let other_phone = "\"mobile_number\":\"81234567\"".as_bytes();
    let h2 = main(id_kv, b1, other_phone, b2, sha256::digest(concat(id_kv, b1)), sha256::digest(concat(other_phone, b2)));
    assert(h != h2);
    let h_again = main(id_kv, [9; 16], phone_kv, [8; 16], sha256::digest(concat(id_kv, [9; 16])), sha256::digest(concat(phone_kv, [8; 16])));
    assert(h == h_again); // blinders don't affect H
}

#[test(should_fail_with = "singpass_id commitment mismatch")]
fn rejects_wrong_blinder() {
    let id_kv = "\"singpass_id\":\"S1234567D\"".as_bytes();
    let phone_kv = "\"mobile_number\":\"91234567\"".as_bytes();
    let _ = main(id_kv, [3; 16], phone_kv, [2; 16], sha256::digest(concat(id_kv, [1; 16])), sha256::digest(concat(phone_kv, [2; 16])));
}

#[test(should_fail_with = "unexpected field")]
fn rejects_other_field_committed() {
    // e.g. committing the email's bytes in place of singpass_id.
    let id_kv = "\"email\":\"a@b.cc\",\"x\":\"12\"".as_bytes();
    let phone_kv = "\"mobile_number\":\"91234567\"".as_bytes();
    let _ = main(id_kv, [1; 16], phone_kv, [2; 16], sha256::digest(concat(id_kv, [1; 16])), sha256::digest(concat(phone_kv, [2; 16])));
}

#[test(should_fail_with = "bad NRIC prefix")]
fn rejects_malformed_nric() {
    let id_kv = "\"singpass_id\":\"X1234567D\"".as_bytes();
    let phone_kv = "\"mobile_number\":\"91234567\"".as_bytes();
    let _ = main(id_kv, [1; 16], phone_kv, [2; 16], sha256::digest(concat(id_kv, [1; 16])), sha256::digest(concat(phone_kv, [2; 16])));
}

#[test(should_fail_with = "mobile must start with 8 or 9")]
fn rejects_non_mobile() {
    let id_kv = "\"singpass_id\":\"S1234567D\"".as_bytes();
    let phone_kv = "\"mobile_number\":\"61234567\"".as_bytes();
    let _ = main(id_kv, [1; 16], phone_kv, [2; 16], sha256::digest(concat(id_kv, [1; 16])), sha256::digest(concat(phone_kv, [2; 16])));
}
