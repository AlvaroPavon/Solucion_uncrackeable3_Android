import zipfile

apk_path = "uncrackable3.apk"
key = b"pizzapizzapizzapizzapizz"

with zipfile.ZipFile(apk_path, "r") as z:
    for f in z.namelist():
        if "libfoo.so" in f and "x86" in f:
            data = z.read(f)
            break

# Dump area around 0x3480
start = 0x3470
end = 0x34c0
chunk = data[start:end]

print(f"Raw hex dump at 0x{start:x}:")
print(chunk.hex())

print("\nXOR with key (alignment 0):")
decrypted = bytes([chunk[i] ^ key[i % len(key)] for i in range(len(chunk))])
print(decrypted)

print("\nXOR with key (alignment try all):")
for offset in range(len(key)):
    decrypted = bytes([chunk[i] ^ key[(i + offset) % len(key)] for i in range(len(chunk))])
    if b"making" in decrypted or b"owasp" in decrypted:
        print(f"Offset {offset}: {decrypted}")
