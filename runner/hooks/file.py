from ..utils.file import media_file
from ..client.file import update_asset
from ..config import ROOT_DIRECTORY

def asset_file_upload_complete_hook(path, key):
    info = media_file(path)
    try:
        data = {
            'name': info['name'],
            'path': info['parent'].replace(ROOT_DIRECTORY + '/sources/', ''),
            'size': info['size'],
            'MIMEType': info['mime'],
            'duration': info['duration'],
            'status': 'COMPLETE'
        }
        update_asset(key['_id'], data)
    except Exception as e:
        print(e)