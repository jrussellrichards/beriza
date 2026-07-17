import os
import sys
import httpx

# Add backend directory to sys.path so we can import from app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.infrastructure.storage import get_storage, StorageS3
from app.core.config import settings

def test_r2():
    print("Testing Cloudflare R2 integration...")
    print(f"FILE_STORAGE: {settings.FILE_STORAGE}")
    print(f"S3_ENDPOINT: {settings.S3_ENDPOINT}")
    print(f"S3_BUCKET: {settings.S3_BUCKET}")
    
    storage = get_storage()
    if not isinstance(storage, StorageS3):
        print("ERROR: Storage implementation is not StorageS3. Please set FILE_STORAGE=s3 in .env.")
        sys.exit(1)
        
    test_content = b"Hello, Cloudflare R2! This is a test file for the Beriza project."
    test_filename = "test_r2_upload.txt"
    test_folder = "test-uploads"
    
    print("\n1. Testing 'subir'...")
    try:
        archivo = storage.subir(test_content, test_filename, test_folder)
        print("Success! Uploaded file.")
        print(f"  URL/Key: {archivo.url}")
        print(f"  Name: {archivo.nombre}")
        print(f"  Size: {archivo.tamaño_bytes} bytes")
    except Exception as e:
        print(f"FAILED 'subir': {e}")
        sys.exit(1)
        
    print("\n2. Testing 'obtener_url_firmada'...")
    try:
        url_firmada = storage.obtener_url_firmada(archivo.url)
        print(f"Success! Generated signed URL:\n{url_firmada}")
        
        # Verify download using httpx
        response = httpx.get(url_firmada)
        if response.status_code == 200 and response.content == test_content:
            print("Success! Downloaded file content matches original.")
        else:
            print(f"ERROR: Download verification failed. Status code: {response.status_code}, content matches: {response.content == test_content}")
            sys.exit(1)
    except Exception as e:
        print(f"FAILED 'obtener_url_firmada' / download: {e}")
        sys.exit(1)
        
    print("\n3. Testing 'eliminar'...")
    try:
        storage.eliminar(archivo.url)
        print("Success! Deleted file from storage.")
    except Exception as e:
        print(f"FAILED 'eliminar': {e}")
        sys.exit(1)
        
    print("\nAll R2 tests PASSED successfully!")

if __name__ == "__main__":
    test_r2()
