import os
from PIL import Image
from ..config import ROOT_DIRECTORY
from ..utils.file import gen_random_id


def generate_multiple_thumbnails(id, thumbnails, root_path=None):
    if root_path:
        thumbnails_dir = os.path.join(root_path, 'thumbnails/{}'.format(id))
    else:
        thumbnails_dir = os.path.join(ROOT_DIRECTORY, 'thumbnails/{}'.format(id))
    if not os.path.exists(thumbnails_dir):
        os.makedirs(thumbnails_dir)
    data = {}
    for key in thumbnails.keys():
        thumbnail_file_path = thumbnails[key]
        im = Image.open(thumbnail_file_path)
        filename = '{}-{}-original.jpg'.format(gen_random_id(16), key)
        filepath = os.path.join(thumbnails_dir, filename)
        im.save(filepath)
        ext_type = '.jpg'
        if key == 'horizontal':
            data['horizontalThumbnail'] = f'/thumbnails/{id}/{filename}'
            resized_filename = '.'.join(filename.split('.')[:-1]).replace('original', 'mid-h') + ext_type
            resized_image = os.path.join(thumbnails_dir, resized_filename)
            im = im.resize((711, 400), Image.Resampling.LANCZOS)
            im.save(resized_image)
            data['horizontalCompressedThumbnail'] = f'/thumbnails/{id}/{resized_filename}'
            resized_filename = '.'.join(filename.split('.')[:-1]).replace('original', 'low-h') + ext_type
            resized_image = os.path.join(thumbnails_dir, resized_filename)
            im = im.resize((210, 119), Image.Resampling.LANCZOS)
            im.save(resized_image)
        if key == 'vertical':
            data['verticalThumbnail'] = f'/thumbnails/{id}/{filename}'
            resized_filename = '.'.join(filename.split('.')[:-1]).replace('original', 'mid-v') + ext_type
            resized_image = os.path.join(thumbnails_dir, resized_filename)
            im = im.resize((224, 336), Image.Resampling.LANCZOS)
            im.save(resized_image)
            data['verticalCompressedThumbnail'] = f'/thumbnails/{id}/{resized_filename}'
            resized_filename = '.'.join(filename.split('.')[:-1]).replace('original', 'low-v') + ext_type
            resized_image = os.path.join(thumbnails_dir, resized_filename)
            im = im.resize((147, 195), Image.Resampling.LANCZOS)
            im.save(resized_image)
        if key == 'square':
            data['squareThumbnail'] = f'/thumbnails/{id}/{filename}'
            resized_filename = '.'.join(filename.split('.')[:-1]).replace('original', 'mid-s') + ext_type
            resized_image = os.path.join(thumbnails_dir, resized_filename)
            base_size = 300
            im = im.resize((base_size, base_size), Image.Resampling.LANCZOS)
            im.save(resized_image)
            data['squareCompressedThumbnail'] = f'/thumbnails/{id}/{resized_filename}'
            resized_filename = '.'.join(filename.split('.')[:-1]).replace('original', 'low-s') + ext_type
            resized_image = os.path.join(thumbnails_dir, resized_filename)
            base_size = 100
            im = im.resize((base_size, base_size), Image.Resampling.LANCZOS)
            im.save(resized_image)

        return data
