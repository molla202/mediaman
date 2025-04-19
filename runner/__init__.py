# coding: utf-8
import falcon
#from falcon_cors import CORS
from .middleware.custom_multipart import CustomMultipartMiddleware
from .router import router

#cors = CORS(allow_all_origins=True)
application = falcon.API(middleware=[CustomMultipartMiddleware()])
router(application)
