# coding: utf-8
from ..controller.file import AssetFiles, AddAssetFile, AssetFileDownload, AssetFileDelete, FileUpload,\
    AssetFileUpload, AddAssetFileToIpfs, AllowedFileTypes, AssetFileEncode, UploadAssetThumbnail, AddDefaultStream, GetDefaultStream

def router(app):
    app.add_route('/runner/users/{userid}/files', AssetFiles())
    app.add_route('/runner/users/{userid}/assets/{asset_id}/file', AddAssetFile())
    app.add_route('/runner/users/{userid}/assets/{asset_id}/delete', AssetFileDelete())
    app.add_route('/runner/users/{userid}/assets/{asset_id}/download', AssetFileDownload())
    app.add_route('/runner/users/{userid}/assets/file-upload', FileUpload())
    app.add_route('/runner/users/{userid}/assets/{asset_id}/file-upload', AssetFileUpload())
    app.add_route('/runner/users/{userid}/assets/{asset_id}/add-to-ipfs', AddAssetFileToIpfs())
    app.add_route('/runner/allowed-file-types', AllowedFileTypes())
    app.add_route('/runner/users/{userid}/assets/{asset_id}/encode', AssetFileEncode())
    app.add_route('/runner/users/{userid}/upload-thumbnail', UploadAssetThumbnail())
    app.add_route('/runner/users/{userid}/add-default-stream', AddDefaultStream())
    app.add_route('/runner/users/{userid}/get-default-stream', GetDefaultStream())
