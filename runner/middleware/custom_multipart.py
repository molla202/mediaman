from falcon_multipart.middleware import MultipartMiddleware
from io import BytesIO

class CustomMultipartMiddleware(MultipartMiddleware):
    def parse_field(self, field):
        if field.filename:
            return field
        if field.type == 'text/plain':
            if field.file is None:
                return ''
            if isinstance(field.file, BytesIO):
                content = field.file.getvalue()
            else:
                content = field.file.read()
            if isinstance(content, bytes):
                return content.decode(self.encoding)
            return content
        if field.file is None:
            return ''
        return field.file.read()