import zipfile
import re

apk_path = "uncrackable3.apk"
# Clave mutada en memoria por libfoo.so
key = bytes([112, 105, 122, 122, 97, 112, 105, 122, 122, 97, 112, 105, 122, 122, 97, 112, 78, 4, 82, 14, 4, 78, 26, 11])

print("[+] Abriendo " + apk_path)
with zipfile.ZipFile(apk_path, "r") as z:
    target_lib = None
    for f in z.namelist():
        if "libfoo.so" in f and "x86" in f:
            target_lib = f
            break
    if not target_lib:
        for f in z.namelist():
            if "libfoo.so" in f:
                target_lib = f
                break
                
    print(f"[+] Extrayendo {target_lib}")
    data = z.read(target_lib)

print(f"[+] Tamaño de libfoo.so: {len(data)} bytes. Buscando flag en binario...")

found = []
for i in range(len(data) - 24):
    chunk = data[i:i+24]
    
    # Ignore chunks that are completely null (0x00) since they just yield the key itself
    if all(c == 0 for c in chunk):
        continue
        
    decrypted = bytes([c ^ k for c, k in zip(chunk, key)])
    
    # Check if printable ASCII
    if all(32 <= c <= 126 for c in decrypted):
        try:
            s = decrypted.decode('ascii', errors='ignore')
            # Extra filter
            if 'making' in s.lower() or 'owasp' in s.lower():
                found.append((i, s))
        except:
            pass

print(f"\n[+] Encontrados {len(found)} candidatos plausibles:")
for offset, s in found:
    print(f"Offset 0x{offset:x}: {repr(s)}")
