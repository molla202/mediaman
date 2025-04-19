module.exports = (app) => {
    /**
     * @swagger
     * tags:
     *   name: Asset Categories
     *   description: API endpoints for managing asset categories
     */

    /**
     * @swagger
     * components:
     *   securitySchemes:
     *     bearerAuth:
     *       type: http
     *       scheme: bearer
     *       bearerFormat: JWT
     *   schemas:
     *     AssetCategory:
     *       type: object
     *       properties:
     *         _id:
     *           type: string
     *         user:
     *           type: string
     *         name:
     *           type: string
     *         global:
     *           type: boolean
     *       required:
     *         - name
     *     errorSchema:
     *       type: object
     *       properties:
     *         success:
     *           type: boolean
     *         message:
     *           type: string
     *         error_info:
     *           type: object
     *           properties:
     *             module:
     *               type: string
     *             code:
     *               type: number
     *     validationError:
     *       type: object
     *       properties:
     *         success:
     *           type: boolean
     *           default: false
     *         error:
     *           type: object
     *           properties:
     *             _original:
     *               type: object
     *               properties:
     *                 field:
     *                   type: string
     *             details:
     *               type: array
     *               items:
     *                 type: object
     *                 properties:
     *                   message:
     *                     type: string
     *                   path:
     *                     type: array
     *                     items:
     *                       type: string
     *                   type:
     *                     type: string
     *                   context:
     *                     type: object
     *                     properties:
     *                       label:
     *                         type: string
     *                       value:
     *                         type: string
     *                       key:
     *                         type: string
     *             level:
     *               type: string
     *               example: "error"
     */

    /**
     * @swagger
     * /asset-categories:
     *   get:
     *     summary: Get all asset categories
     *     description: |
     *       Retrieve a list of all asset categories.
     *       Optional query parameters:
     *       - encode
     *     tags: [Asset Categories]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: query
     *         name: encode
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Successful response
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 $ref: '#/components/schemas/AssetCategory'
     *       422:
     *         description: The server understood the request, but it was unable to process the contained instructions due to invalid input. This could be due to validation errors.
     *         content:
     *           application/json:
     *             schema:
     *               allOf:
     *                 - $ref: '#/components/schemas/validationError'
     *       500:
     *         description: An error occurred while processing the request
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/errorSchema'
     *             examples:
     *               findAssetCategoryFailed:
     *                 value:
     *                   success: false
     *                   message: "Invalid input parameters."
     *                   error_info:
     *                     module: "asset_category"
     *                     code: 1
     *               jwtVerificationFailed:
     *                 value:
     *                   success: false
     *                   message: "JWT token is required for this request."
     *                   error_info:
     *                     module: "auth"
     *                     code: 1
     */

    /**
     * @swagger
     * /asset-categories:
     *   post:
     *     summary: Add a new asset category
     *     description: |
     *       Create a new asset category.
     *       Required fields:
     *       - name
     *     tags: [Asset Categories]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               name:
     *                 type: string
     *             required:
     *               - name
     *     responses:
     *       201:
     *         description: Asset category created successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/AssetCategory'
     *       422:
     *         description: The server understood the request, but it was unable to process the contained instructions due to invalid input. This could be due to validation errors.
     *         content:
     *           application/json:
     *             schema:
     *               allOf:
     *                 - $ref: '#/components/schemas/validationError'
     *       500:
     *         description: An error occurred while processing the request
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/errorSchema'
     *             examples:
     *               saveAssetCategoryFailed:
     *                 value:
     *                   success: false
     *                   message: "Invalid input parameters."
     *                   error_info:
     *                     module: "asset_category"
     *                     code: 2
     *               jwtVerificationFailed:
     *                 value:
     *                   success: false
     *                   message: "JWT token is required for this request."
     *                   error_info:
     *                     module: "auth"
     *                     code: 1
     */

    /**
     * @swagger
     * /asset-categories/{id}:
     *   put:
     *     summary: Update an asset category
     *     description: |
     *       Update an existing asset category.
     *       Required parameters:
     *       - id (path parameter)
     *       Optional fields:
     *       - name
     *     tags: [Asset Categories]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               name:
     *                 type: string
     *             required:
     *               - name
     *     responses:
     *       200:
     *         description: Asset category updated successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/AssetCategory'
     *       422:
     *         description: The server understood the request, but it was unable to process the contained instructions due to invalid input. This could be due to validation errors.
     *         content:
     *           application/json:
     *             schema:
     *               allOf:
     *                 - $ref: '#/components/schemas/validationError'
     *       404:
     *         description: Asset category not found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/errorSchema'
     *             example:
     *               success: false
     *               message: "Asset category does not exist."
     *               error_info:
     *                 module: "asset_category"
     *                 code: 5
     *       500:
     *         description: An error occurred while processing the request
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/errorSchema'
     *             examples:
     *               updateAssetCategoryFailed:
     *                 value:
     *                   success: false
     *                   message: "Invalid input parameters."
     *                   error_info:
     *                     module: "asset_category"
     *                     code: 3
     *               jwtVerificationFailed:
     *                 value:
     *                   success: false
     *                   message: "JWT token is required for this request."
     *                   error_info:
     *                     module: "auth"
     *                     code: 1
     */

    /**
     * @swagger
     * /asset-categories/{id}:
     *   delete:
     *     summary: Delete an asset category
     *     description: |
     *       Delete an existing asset category.
     *       Required parameters:
     *       - id (path parameter)
     *     tags: [Asset Categories]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Asset category deleted successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                 message:
     *                   type: string
     *             example:
     *               success: true
     *               message: "Asset category deleted successfully."
     *       422:
     *         description: The server understood the request, but it was unable to process the contained instructions due to invalid input. This could be due to validation errors.
     *         content:
     *           application/json:
     *             schema:
     *               allOf:
     *                 - $ref: '#/components/schemas/validationError'
     *       500:
     *         description: An error occurred while processing the request
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/errorSchema'
     *             examples:
     *               jwtVerificationFailed:
     *                 value:
     *                   success: false
     *                   message: "JWT token is required for this request."
     *                   error_info:
     *                     module: "auth"
     *                     code: 1
     *               notFound:
     *                 value:
     *                   success: false
     *                   message: "Asset category does not exist."
     *                   error_info:
     *                     module: "asset_category"
     *                     code: 5
     *               deleteAssetCategoryFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while deleting asset category."
     *                   error_info:
     *                     module: "asset_category"
     *                     code: 4
     */

    /**
     * @swagger
     * tags:
     *   name: Assets
     *   description: API endpoints for managing assets
     */

    /**
     * @swagger
     * components:
     *   schemas:
     *     Asset:
     *       type: object
     *       properties:
     *         _id:
     *           type: string
     *         name:
     *           type: string
     *         type:
     *           type: string
     *           enum: [video, audio]
     *         category:
     *           type: string
     *         description:
     *           type: string
     *         tags:
     *           type: array
     *           items:
     *             type: string
     *         file:
     *           type: object
     *           properties:
     *             download:
     *               type: object
     *             encode:
     *               type: object
     *         thumbnail:
     *           type: object
     *           properties:
     *             horizontal:
     *               type: string
     *             vertical:
     *               type: string
     *             square:
     *               type: string
     *       required:
     *         - name
     *         - type
     */

    /**
     * @swagger
     * /assets:
     *   get:
     *     summary: Get all assets
     *     tags: [Assets]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: query
     *         name: skip
     *         schema:
     *           type: integer
     *       - in: query
     *         name: limit
     *         schema:
     *           type: integer
     *       - in: query
     *         name: sortBy
     *         schema:
     *           type: string
     *       - in: query
     *         name: order
     *         schema:
     *           type: string
     *           enum: [asc, desc]
     *       - in: query
     *         name: type
     *         schema:
     *           type: string
     *           enum: [video, audio]
     *       - in: query
     *         name: category
     *         schema:
     *           type: string
     *       - in: query
     *         name: search
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Successful response
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 list:
     *                   type: array
     *                   items:
     *                     $ref: '#/components/schemas/Asset'
     *                 count:
     *                   type: integer
     *       422:
     *         $ref: '#/components/responses/ValidationError'
     *       500:
     *         description: An error occurred while processing the request
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/errorSchema'
     *             examples:
     *               jwtVerificationFailed:
     *                 value:
     *                   success: false
     *                   message: "JWT token is required for this request."
     *                   error_info:
     *                     module: "auth"
     *                     code: 1
     *               findAssetFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while finding the assets."
     *                   error_info:
     *                     module: "asset"
     *                     code: 1
     *               countLiveStreamsFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while finding the asset count."
     *                   error_info:
     *                     module: "asset"
     *                     code: 13
     */

    /**
     * @swagger
     * /assets:
     *   post:
     *     summary: Add a new asset
     *     tags: [Assets]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               type:
     *                 type: string
     *                 enum: [video, audio]
     *               name:
     *                 type: string
     *               category:
     *                 type: string
     *               description:
     *                 type: string
     *               tags:
     *                 type: array
     *                 items:
     *                   type: string
     *               file:
     *                 type: object
     *                 properties:
     *                   source:
     *                     type: string
     *                   id:
     *                     type: string
     *             required:
     *               - type
     *               - name
     *     responses:
     *       201:
     *         description: Asset created successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Asset'
     *       400:
     *         description: Bad request
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/errorSchema'
     *             example:
     *               success: false
     *               message: "Asset already exist."
     *               error_info:
     *                 module: "asset"
     *                 code: 6
     *       422:
     *         $ref: '#/components/responses/ValidationError'
     *       500:
     *         description: An error occurred while processing the request
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/errorSchema'
     *             examples:
     *               jwtVerificationFailed:
     *                 value:
     *                   success: false
     *                   message: "JWT token is required for this request."
     *                   error_info:
     *                     module: "auth"
     *                     code: 1
     *               findAssetFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while finding the asset."
     *                   error_info:
     *                     module: "asset"
     *                     code: 1
     *               saveAssetFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while saving the asset."
     *                   error_info:
     *                     module: "asset"
     *                     code: 2
     *               requestRunnerFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while requesting the runner."
     *                   error_info:
     *                     module: "asset"
     *                     code: 9
     *               updateAssetFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while updating the asset."
     *                   error_info:
     *                     module: "asset"
     *                     code: 3
     */

    /**
     * @swagger
     * /assets/{id}:
     *   get:
     *     summary: Get an asset by ID
     *     tags: [Assets]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Successful response
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Asset'
     *       404:
     *         description: Asset not found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/errorSchema'
     *             example:
     *               success: false
     *               message: "Asset does not exist."
     *               error_info:
     *                 module: "asset"
     *                 code: 5
     *       422:
     *         $ref: '#/components/responses/ValidationError'
     *       500:
     *         description: An error occurred while processing the request
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/errorSchema'
     *             examples:
     *               jwtVerificationFailed:
     *                 value:
     *                   success: false
     *                   message: "JWT token is required for this request."
     *                   error_info:
     *                     module: "auth"
     *                     code: 1
     *               findAssetFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while finding the asset."
     *                   error_info:
     *                     module: "asset"
     *                     code: 1
     */

    /**
     * @swagger
     * /assets/{id}:
     *   put:
     *     summary: Update an asset
     *     tags: [Assets]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               name:
     *                 type: string
     *               category:
     *                 type: string
     *               description:
     *                 type: string
     *               tags:
     *                 type: array
     *                 items:
     *                   type: string
     *     responses:
     *       200:
     *         description: Asset updated successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Asset'
     *       404:
     *         description: Asset not found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/errorSchema'
     *             example:
     *               success: false
     *               message: "Asset does not exist."
     *               error_info:
     *                 module: "asset"
     *                 code: 5
     *       422:
     *         $ref: '#/components/responses/ValidationError'
     *       500:
     *         description: An error occurred while processing the request
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/errorSchema'
     *             examples:
     *               jwtVerificationFailed:
     *                 value:
     *                   success: false
     *                   message: "JWT token is required for this request."
     *                   error_info:
     *                     module: "auth"
     *                     code: 1
     *               updateAssetFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while updating the asset."
     *                   error_info:
     *                     module: "asset"
     *                     code: 3
     *               requestRunnerFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while requesting the runner."
     *                   error_info:
     *                     module: "asset"
     *                     code: 9
     */

    /**
     * @swagger
     * /assets/{id}:
     *   delete:
     *     summary: Delete an asset
     *     tags: [Assets]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Asset deleted successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                 message:
     *                   type: string
     *             example:
     *               success: true
     *               message: "Asset deleted successfully."
     *       422:
     *         $ref: '#/components/responses/ValidationError'
     *       500:
     *         description: An error occurred while processing the request
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/errorSchema'
     *             examples:
     *               jwtVerificationFailed:
     *                 value:
     *                   success: false
     *                   message: "JWT token is required for this request."
     *                   error_info:
     *                     module: "auth"
     *                     code: 1
     *               findAssetFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while finding the asset."
     *                   error_info:
     *                     module: "asset"
     *                     code: 1
     *               requestRunnerFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while requesting the runner."
     *                   error_info:
     *                     module: "asset"
     *                     code: 9
     *               deleteAssetFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while deleting the asset."
     *                   error_info:
     *                     module: "asset"
     *                     code: 4
     *               updateAssetFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while updating the asset."
     *                   error_info:
     *                     module: "asset"
     *                     code: 3
     */

    /**
     * @swagger
     * /assets/{id}/encode:
     *   put:
     *     summary: Encode an asset
     *     tags: [Assets]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Asset encoding initiated successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Asset'
     *       400:
     *         description: Bad request
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/errorSchema'
     *             example:
     *               success: false
     *               message: "Asset does not exist or invalid file download status or invalid file type"
     *               error_info:
     *                 module: "asset"
     *                 code: 5
     *       422:
     *         $ref: '#/components/responses/ValidationError'
     *       500:
     *         description: An error occurred while processing the request
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/errorSchema'
     *             examples:
     *               jwtVerificationFailed:
     *                 value:
     *                   success: false
     *                   message: "JWT token is required for this request."
     *                   error_info:
     *                     module: "auth"
     *                     code: 1
     *               findAssetFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while finding the asset."
     *                   error_info:
     *                     module: "asset"
     *                     code: 1
     *               requestRunnerFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while requesting the runner."
     *                   error_info:
     *                     module: "asset"
     *                     code: 9
     *               updateAssetFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while updating the asset."
     *                   error_info:
     *                     module: "asset"
     *                     code: 3
     */

    /**
     * @swagger
     * /assets-overview:
     *   get:
     *     summary: Get assets overview
     *     tags: [Assets]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: query
     *         name: encode
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Successful response
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 type: object
     *                 properties:
     *                   type:
     *                     type: string
     *                   count:
     *                     type: integer
     *       422:
     *         $ref: '#/components/responses/ValidationError'
     *       500:
     *         description: An error occurred while processing the request
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/errorSchema'
     *             examples:
     *               jwtVerificationFailed:
     *                 value:
     *                   success: false
     *                   message: "JWT token is required for this request."
     *                   error_info:
     *                     module: "auth"
     *                     code: 1
     *               overviewAssetsFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while finding the assets type-wise count."
     *                   error_info:
     *                     module: "asset"
     *                     code: 14
     */

    /**
     * @swagger
     * /assets/{id}/watch-url:
     *   get:
     *     summary: Get asset watch URL
     *     tags: [Assets]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *       - in: query
     *         name: deviceId
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Successful response
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 assetUrl:
     *                   type: string
     *       404:
     *         description: Asset not found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/errorSchema'
     *             examples:
     *               assetDoesNotExist:
     *                 value:
     *                   success: false
     *                   message: "Asset does not exist."
     *                   error_info:
     *                     module: "asset"
     *                     code: 5
     *               assetNotEncoded:
     *                 value:
     *                   success: false
     *                   message: "Asset does not exist / not encoded."
     *                   error_info:
     *                     module: "asset"
     *                     code: 5
     *       422:
     *         $ref: '#/components/responses/ValidationError'
     *       500:
     *         description: An error occurred while processing the request
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/errorSchema'
     *             examples:
     *               jwtVerificationFailed:
     *                 value:
     *                   success: false
     *                   message: "JWT token is required for this request."
     *                   error_info:
     *                     module: "auth"
     *                     code: 1
     *               findAssetFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while finding the asset."
     *                   error_info:
     *                     module: "asset"
     *                     code: 1
     */

    /**
     * @swagger
     * components:
     *   responses:
     *     ValidationError:
     *       description: The server understood the request, but it was unable to process the contained instructions due to invalid input. This could be due to validation errors.
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/validationError'
     *     ServerError:
     *       description: An error occurred while processing the request
     *       content:
     *         application/json:
     *           schema:
     *             allOf:
     *               - $ref: '#/components/schemas/errorSchema'
     *           examples:
     *             jwtVerificationFailed:
     *               value:
     *                 success: false
     *                 message: "JWT token is required for this request."
     *                 error_info:
     *                   module: "auth"
     *                   code: 1
     *             serverError:
     *               value:
     *                 success: false
     *                 message: "An error occurred while processing the request."
     *                 error_info:
     *                   module: "asset"
     *                   code: 1
     */

    /**
     * @swagger
     * tags:
     *   name: Live Streams
     *   description: API endpoints for managing live streams
     */

    /**
     * @swagger
     * components:
     *   schemas:
     *     LiveStream:
     *       type: object
     *       properties:
     *         _id:
     *           type: string
     *         name:
     *           type: string
     *         created_by:
     *           type: string
     *         previews:
     *           type: object
     *         image_url:
     *           type: string
     *         description:
     *           type: string
     *         start_at:
     *           type: string
     *           format: date-time
     *         end_at:
     *           type: string
     *           format: date-time
     *         views:
     *           type: object
     *         tags:
     *           type: array
     *           items:
     *             type: string
     *         status:
     *           type: string
     *           enum: [UP_COMING, LIVE, ENDED]
     *         embed:
     *           type: boolean
     *         default:
     *           type: boolean
     *         playing_live_feed:
     *           type: boolean
     *         configuration:
     *           type: object
     *       required:
     *         - name
     *         - created_by
     */

    /**
     * @swagger
     * /live-streams:
     *   get:
     *     summary: Get all live streams
     *     tags: [Live Streams]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: query
     *         name: status
     *         schema:
     *           type: string
     *           enum: [UP_COMING, LIVE, ENDED]
     *       - in: query
     *         name: skip
     *         schema:
     *           type: integer
     *       - in: query
     *         name: limit
     *         schema:
     *           type: integer
     *       - in: query
     *         name: sortBy
     *         schema:
     *           type: string
     *       - in: query
     *         name: order
     *         schema:
     *           type: string
     *           enum: [asc, desc]
     *       - in: query
     *         name: liveFeed
     *         schema:
     *           type: boolean
     *     responses:
     *       200:
     *         description: Successful response
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 list:
     *                   type: array
     *                   items:
     *                     $ref: '#/components/schemas/LiveStream'
     *                 total:
     *                   type: integer
     *       422:
     *         $ref: '#/components/responses/ValidationError'
     *       500:
     *         description: Server error
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/errorSchema'
     *             examples:
     *               findLiveStreamsFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while finding the live streams."
     *                   error_info:
     *                     module: "live_stream"
     *                     code: 3
     *               countLiveStreamsFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while finding the live streams count."
     *                   error_info:
     *                     module: "live_stream"
     *                     code: 1
     */

    /**
     * @swagger
     * /live-streams:
     *   post:
     *     summary: Add a new live stream
     *     tags: [Live Streams]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               name:
     *                 type: string
     *               imageURL:
     *                 type: string
     *               description:
     *                 type: string
     *             required:
     *               - name
     *     responses:
     *       200:
     *         description: Live stream created successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/LiveStream'
     *       422:
     *         $ref: '#/components/responses/ValidationError'
     *       500:
     *         description: Server error
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/errorSchema'
     *             examples:
     *               createLiveStreamBroadcastFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while creating live stream."
     *                   error_info:
     *                     module: "live_stream"
     *                     code: 11
     */

    /**
     * @swagger
     * /live-streams/{id}:
     *   put:
     *     summary: Update a live stream
     *     tags: [Live Streams]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/LiveStreamUpdate'
     *     responses:
     *       200:
     *         description: Live stream updated successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/LiveStream'
     *       422:
     *         $ref: '#/components/responses/ValidationError'
     *       404:
     *         description: Live stream not found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/errorSchema'
     *             example:
     *               success: false
     *               message: "Live stream does not exist."
     *               error_info:
     *                 module: "live_stream"
     *                 code: 5
     *       500:
     *         description: Server error
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/errorSchema'
     *             examples:
     *               updateLiveStreamFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while updating the live stream."
     *                   error_info:
     *                     module: "live_stream"
     *                     code: 4
     *               liveStreamDoesNotExist:
     *                 value:
     *                   success: false
     *                   message: "Live stream does not exist."
     *                   error_info:
     *                     module: "live_stream"
     *                     code: 5
     */

    /**
     * @swagger
     * /live-streams/{id}/config:
     *   get:
     *     summary: Get live stream configuration
     *     tags: [Live Streams]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Successful response
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/LiveStream'
     *       422:
     *         $ref: '#/components/responses/ValidationError'
     *       500:
     *         description: Server error
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/errorSchema'
     *             examples:
     *               findLiveStreamFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while finding the live stream."
     *                   error_info:
     *                     module: "live_stream"
     *                     code: 8
     */

    /**
     * @swagger
     * /live-streams/{id}/start:
     *   post:
     *     summary: Start a live stream
     *     tags: [Live Streams]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Live stream started successfully
     *       422:
     *         $ref: '#/components/responses/ValidationError'
     *       404:
     *         description: Live stream not found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/errorSchema'
     *             example:
     *               success: false
     *               message: "Live stream does not exist."
     *               error_info:
     *                 module: "live_stream"
     *                 code: 5
     *       500:
     *         description: Server error
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/errorSchema'
     *             examples:
     *               findLiveStreamFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while finding the live stream."
     *                   error_info:
     *                     module: "live_stream"
     *                     code: 8
     *               createNginxFileFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while creating nginx config."
     *                   error_info:
     *                     module: "live_stream"
     *                     code: 18
     *               reloadFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while reloading NGINX"
     *                   error_info:
     *                     module: "manage_ms"
     *                     code: 3
     *               requestRunnerFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while requesting the runner."
     *                   error_info:
     *                     module: "live_stream"
     *                     code: 15
     *               updateLiveStreamFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while updating the live stream."
     *                   error_info:
     *                     module: "live_stream"
     *                     code: 4
     */

    /**
     * @swagger
     * /live-streams/{id}/stop:
     *   post:
     *     summary: Stop a live stream
     *     tags: [Live Streams]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Live stream stopped successfully
     *       422:
     *         $ref: '#/components/responses/ValidationError'
     *       404:
     *         description: Live stream not found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/errorSchema'
     *             example:
     *               success: false
     *               message: "Live stream does not exist."
     *               error_info:
     *                 module: "live_stream"
     *                 code: 5
     *       500:
     *         description: Server error
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/errorSchema'
     *             examples:
     *               findLiveStreamFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while finding the live stream."
     *                   error_info:
     *                     module: "live_stream"
     *                     code: 8
     *               liveStreamDoesNotExist:
     *                 value:
     *                   success: false
     *                   message: "Live stream does not exist."
     *                   error_info:
     *                     module: "live_stream"
     *                     code: 5
     *               requestRunnerFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while requesting the runner."
     *                   error_info:
     *                     module: "live_stream"
     *                     code: 15
     *               updateLiveStreamFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while updating the live stream."
     *                   error_info:
     *                     module: "live_stream"
     *                     code: 4
     */

    /**
     * @swagger
     * /live-streams/{id}/live-text:
     *   post:
     *     summary: Update live stream text
     *     tags: [Live Streams]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               text:
     *                 type: string
     *             required:
     *               - text
     *     responses:
     *       200:
     *         description: Live stream text updated successfully
     *       422:
     *         $ref: '#/components/responses/ValidationError'
     *       404:
     *         description: Live stream not found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/errorSchema'
     *             example:
     *               success: false
     *               message: "Live stream does not exist."
     *               error_info:
     *                 module: "live_stream"
     *                 code: 5
     *       500:
     *         description: Server error
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/errorSchema'
     *             examples:
     *               findLiveStreamFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while finding the live stream."
     *                   error_info:
     *                     module: "live_stream"
     *                     code: 8
     *               liveStreamDoesNotExist:
     *                 value:
     *                   success: false
     *                   message: "Live stream does not exist."
     *                   error_info:
     *                     module: "live_stream"
     *                     code: 5
     *               requestRunnerFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while requesting the runner."
     *                   error_info:
     *                     module: "live_stream"
     *                     code: 15
     */

    /**
     * @swagger
     * /live-streams/{id}/status:
     *   get:
     *     summary: Get live stream status
     *     tags: [Live Streams]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Successful response
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 status:
     *                   type: string
     *                 stream:
     *                   type: object
     *       422:
     *         $ref: '#/components/responses/ValidationError'
     *       500:
     *         description: Server error
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/errorSchema'
     *             examples:
     *               requestRunnerFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while requesting the runner."
     *                   error_info:
     *                     module: "live_stream"
     *                     code: 15
     */

    /**
     * @swagger
     * /live-streams/{id}/watch-url:
     *   get:
     *     summary: Get live stream watch URL
     *     tags: [Live Streams]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *       - in: query
     *         name: ip
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Successful response
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 streamUrl:
     *                   type: string
     *       422:
     *         $ref: '#/components/responses/ValidationError'
     *       500:
     *         description: Server error
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/errorSchema'
     *             examples:
     *               findLiveStreamsFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while finding the live streams."
     *                   error_info:
     *                     module: "live_stream"
     *                     code: 3
     *               streamUrlFetchFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while fetching the live stream url."
     *                   error_info:
     *                     module: "live_stream"
     *                     code: 16
     */

    /**
     * @swagger
     * tags:
     *   name: Manage Microservices
     *   description: API endpoints for managing microservices
     */

    /**
     * @swagger
     * /docker/restart/runner:
     *   post:
     *     summary: Restart the runner service
     *     tags: [Manage Microservices]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               data:
     *                 type: object
     *             required:
     *               - data
     *     responses:
     *       200:
     *         description: Runner restart triggered successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 message:
     *                   type: string
     *             example:
     *               message: "Runner restart triggered with updated config!"
     *       422:
     *         $ref: '#/components/responses/ValidationError'
     *       500:
     *         description: Server error
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/errorSchema'
     *             examples:
     *               configUpdateFailed:
     *                 value:
     *                   success: false
     *                   message: "Error updating configuration file"
     *                   error_info:
     *                     module: "manage_ms"
     *                     code: 1
     *               configUpdateFailed-1:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while updating supervisor configuration"
     *                   error_info:
     *                     module: "manage_ms"
     *                     code: 1
     *               configUpdateFailed-2:
     *                 value:
     *                   success: false
     *                   message: "Console error occurred while updating supervisor configuration"
     *                   error_info:
     *                     module: "manage_ms"
     *                     code: 1
     *               restartFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while restarting Runner"
     *                   error_info:
     *                     module: "manage_ms"
     *                     code: 2
     *               restartFailed-1:
     *                 value:
     *                   success: false
     *                   message: "Runner failed to start"
     *                   error_info:
     *                     module: "manage_ms"
     *                     code: 2
     *               restartFailed-2:
     *                 value:
     *                   success: false
     *                   message: "Console error occurred while restarting Runner"
     *                   error_info:
     *                     module: "manage_ms"
     *                     code: 2
     */

    /**
     * @swagger
     * /docker/restart/studio:
     *   post:
     *     summary: Restart the studio service
     *     tags: [Manage Microservices]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               data:
     *                 type: object
     *             required:
     *               - data
     *     responses:
     *       200:
     *         description: Studio restart triggered successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 message:
     *                   type: string
     *             example:
     *               message: "Studio restart triggered with updated config!"
     *       422:
     *         $ref: '#/components/responses/ValidationError'
     *       500:
     *         description: Server error
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/errorSchema'
     *             examples:
     *               configUpdateFailed:
     *                 value:
     *                   success: false
     *                   message: "Error updating configuration file"
     *                   error_info:
     *                     module: "manage_ms"
     *                     code: 1
     *               configUpdateFailed-1:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while updating supervisor configuration"
     *                   error_info:
     *                     module: "manage_ms"
     *                     code: 1
     *               configUpdateFailed-2:
     *                 value:
     *                   success: false
     *                   message: "Console error occurred while updating supervisor configuration"
     *                   error_info:
     *                     module: "manage_ms"
     *                     code: 1
     */

    /**
     * @swagger
     * /docker/restart/nginx:
     *   post:
     *     summary: Restart the NGINX service
     *     tags: [Manage Microservices]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: NGINX restart triggered successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 message:
     *                   type: string
     *             example:
     *               message: "NGINX restart triggered successfully!"
     *       422:
     *         $ref: '#/components/responses/ValidationError'
     *       500:
     *         description: Server error
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/errorSchema'
     *             examples:
     *               restartFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while restarting NGINX"
     *                   error_info:
     *                     module: "manage_ms"
     *                     code: 2
     *               restartFailed-1:
     *                 value:
     *                   success: false
     *                   message: "NGINX failed to start"
     *                   error_info:
     *                     module: "manage_ms"
     *                     code: 2
     *               restartFailed-2:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while reloading NGINX"
     *                   error_info:
     *                     module: "manage_ms"
     *                     code: 2
     */

    /**
     * @swagger
     * /docker/restart/redis:
     *   post:
     *     summary: Restart the Redis service
     *     tags: [Manage Microservices]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Redis restart triggered successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 message:
     *                   type: string
     *             example:
     *               message: "Redis restart triggered successfully!"
     *       422:
     *         $ref: '#/components/responses/ValidationError'
     *       500:
     *         description: Server error
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/errorSchema'
     *             examples:
     *               restartFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while restarting Redis"
     *                   error_info:
     *                     module: "manage_ms"
     *                     code: 2
     *               restartFailed-1:
     *                 value:
     *                   success: false
     *                   message: "Redis failed to start"
     *                   error_info:
     *                     module: "manage_ms"
     *                     code: 2
     *               restartFailed-2:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while reloading Redis"
     *                   error_info:
     *                     module: "manage_ms"
     *                     code: 2
     */

    /**
     * @swagger
     * tags:
     *   name: Source Types
     *   description: API endpoints for managing source types
     */

    /**
     * @swagger
     * components:
     *   schemas:
     *     SourceType:
     *       type: object
     *       properties:
     *         _id:
     *           type: string
     *         name:
     *           type: string
     *         base_URL:
     *           type: string
     *       required:
     *         - name
     */

    /**
     * @swagger
     * /source-types:
     *   get:
     *     summary: Get all source types
     *     description: Retrieve a list of all source types.
     *     tags: [Source Types]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Successful response
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 $ref: '#/components/schemas/SourceType'
     *       500:
     *         description: Server error
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/errorSchema'
     *             examples:
     *               findSourceTypeFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while finding the source types."
     *                   error_info:
     *                     module: "source_type"
     *                     code: 1
     */

    /**
     * @swagger
     * /source-types:
     *   post:
     *     summary: Add a new source type
     *     description: |
     *       Create a new source type.
     *       Required fields:
     *       - name
     *     tags: [Source Types]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               name:
     *                 type: string
     *             required:
     *               - name
     *     responses:
     *       201:
     *         description: Source type created successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/SourceType'
     *       422:
     *         $ref: '#/components/responses/ValidationError'
     *       500:
     *         description: Server error
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/errorSchema'
     *             examples:
     *               saveSourceTypeFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while saving the source type."
     *                   error_info:
     *                     module: "source_type"
     *                     code: 2
     */

    /**
     * @swagger
     * /source-types/{id}:
     *   put:
     *     summary: Update a source type
     *     description: |
     *       Update an existing source type.
     *       Required fields:
     *       - name
     *     tags: [Source Types]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               name:
     *                 type: string
     *             required:
     *               - name
     *     responses:
     *       200:
     *         description: Source type updated successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/SourceType'
     *       422:
     *         $ref: '#/components/responses/ValidationError'
     *       404:
     *         description: Source type not found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/errorSchema'
     *             example:
     *               success: false
     *               message: "Source type does not exist."
     *               error_info:
     *                 module: "source_type"
     *                 code: 5
     *       500:
     *         description: Server error
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/errorSchema'
     *             examples:
     *               updateSourceTypeFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while updating the source type."
     *                   error_info:
     *                     module: "source_type"
     *                     code: 3
     */

    /**
     * @swagger
     * /source-types/{id}:
     *   delete:
     *     summary: Delete a source type
     *     description: |
     *       Delete an existing source type.
     *       Required parameters:
     *       - id (path parameter)
     *     tags: [Source Types]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Source type deleted successfully
     *       422:
     *         $ref: '#/components/responses/ValidationError'
     *       500:
     *         description: Server error
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/errorSchema'
     *             examples:
     *               deleteSourceTypeFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while deleting the source type."
     *                   error_info:
     *                     module: "source_type"
     *                     code: 4
     */

    /**
     * @swagger
     * tags:
     *   name: User Management
     *   description: API endpoints for user management
     */

    /**
     * @swagger
     * components:
     *   schemas:
     *     User:
     *       type: object
     *       properties:
     *         _id:
     *           type: string
     *         bc_account_address:
     *           type: string
     *         permissions:
     *           type: array
     *           items:
     *             type: string
     *             enum: [studio, runner, ipfs, streamer]
     *         auth_token:
     *           type: string
     *         fee_grant:
     *           type: object
     *           properties:
     *             status:
     *               type: string
     *               enum: [UNCLAIMED, CLAIMED]
     *             tx_hash:
     *               type: string
     *             updated_at:
     *               type: string
     *               format: date-time
     *       required:
     *         - bc_account_address
     *         - permissions
     *         - auth_token
     */

    /**
     * @swagger
     * /user/connect-bc-account:
     *   post:
     *     summary: Connect blockchain account
     *     description: |
     *       Connect a blockchain account to the user profile.
     *       Required fields:
     *       - bcAccountAddress
     *     tags: [User Management]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               bcAccountAddress:
     *                 type: string
     *             required:
     *               - bcAccountAddress
     *     responses:
     *       200:
     *         description: Blockchain account connected successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 _id:
     *                   type: string
     *                 bc_account:
     *                   type: string
     *                 auth_code:
     *                   type: string
     *                 auth_token:
     *                   type: string
     *       422:
     *         $ref: '#/components/responses/ValidationError'
     *       500:
     *         description: Server error
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/errorSchema'
     *             examples:
     *               findUserFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while finding the user."
     *                   error_info:
     *                     module: "user"
     *                     code: 1
     *               invalidBCAccountAddress:
     *                 value:
     *                   success: false
     *                   message: "Invalid account address."
     *                   error_info:
     *                     module: "user"
     *                     code: 10
     *               invalidBCAccountAddress-1:
     *                 value:
     *                   success: false
     *                   message: "Not omniflix address."
     *                   error_info:
     *                     module: "user"
     *                     code: 10
     *               userDoesNotExist:
     *                 value:
     *                   success: false
     *                   message: "User not allowed to login."
     *                   error_info:
     *                     module: "user"
     *                     code: 2
     *               saveUserLoginFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while saving the User login info"
     *                   error_info:
     *                     module: "user_login"
     *                     code: 4
     */

    /**
     * @swagger
     * /user/{userId}/verify-bc-account:
     *   post:
     *     summary: Verify blockchain account
     *     description: |
     *       Verify the blockchain account connection.
     *       Required fields:
     *       - authCode
     *       - authToken
     *       - sign (object with signature and pub_key)
     *     tags: [User Management]
     *     parameters:
     *       - in: path
     *         name: userId
     *         required: true
     *         schema:
     *           type: string
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               authCode:
     *                 type: number
     *               authToken:
     *                 type: string
     *               sign:
     *                 type: object
     *                 properties:
     *                   signature:
     *                     type: string
     *                   pub_key:
     *                     type: object
     *                     properties:
     *                       type:
     *                         type: string
     *                       value:
     *                         type: string
     *             required:
     *               - authCode
     *               - authToken
     *               - sign
     *     responses:
     *       200:
     *         description: Blockchain account verified successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 access_token:
     *                   type: string
     *                 refresh_token:
     *                   type: string
     *       422:
     *         $ref: '#/components/responses/ValidationError'
     *       500:
     *         description: Server error
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/errorSchema'
     *             examples:
     *               findUserFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while finding the user."
     *                   error_info:
     *                     module: "user"
     *                     code: 1
     *               userDoesNotExist:
     *                 value:
     *                   success: false
     *                   message: "User does not exist."
     *                   error_info:
     *                     module: "user"
     *                     code: 2
     *               unAuthorizedAccess:
     *                 value:
     *                   success: false
     *                   message: "Auth Token does not match."
     *                   error_info:
     *                     module: "user"
     *                     code: 7
     *               findUserLoginFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while finding the User login info"
     *                   error_info:
     *                     module: "user_login"
     *                     code: 1
     *               loginRequestExpired:
     *                 value:
     *                   success: false
     *                   message: "Login request expired."
     *                   error_info:
     *                     module: "user_login"
     *                     code: 6
     *               loginRequestDoesNotExist:
     *                 value:
     *                   success: false
     *                   message: "Login request does not exist with given details."
     *                   error_info:
     *                     module: "user"
     *                     code: 8
     *               invalidSignature:
     *                 value:
     *                   success: false
     *                   message: "Invalid signature."
     *                   error_info:
     *                     module: "user"
     *                     code: 9
     *               updateUserLoginFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while updating the user login info."
     *                   error_info:
     *                     module: "user_login"
     *                     code: 3
     */

    /**
     * @swagger
     * /user/auth/refresh-token:
     *   post:
     *     summary: Refresh user access token
     *     description: |
     *       Refresh the user's access token using a refresh token.
     *       Required fields:
     *       - refreshToken
     *     tags: [User Management]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               refreshToken:
     *                 type: string
     *             required:
     *               - refreshToken
     *     responses:
     *       200:
     *         description: Access token refreshed successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 access_token:
     *                   type: string
     *                 refresh_token:
     *                   type: string
     *       422:
     *         $ref: '#/components/responses/ValidationError'
     *       500:
     *         description: Server error
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/errorSchema'
     *             examples:
     *               invalidRefreshToken:
     *                 value:
     *                   success: false
     *                   message: "Invalid refresh token."
     *                   error_info:
     *                     module: "user"
     *                     code: 11
     */

    /**
     * @swagger
     * /user/profile/details:
     *   get:
     *     summary: Get user profile details
     *     description: Retrieve the authenticated user's profile details.
     *     tags: [User Management]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: User profile details retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/User'
     *       500:
     *         description: Server error
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/errorSchema'
     *             examples:
     *               findUserFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while finding the user."
     *                   error_info:
     *                     module: "user"
     *                     code: 1
     */

    /**
     * @swagger
     * /user/profile/details:
     *   put:
     *     summary: Update user profile details
     *     description: |
     *       Update the authenticated user's profile details.
     *       Optional fields:
     *       - emailAddress
     *     tags: [User Management]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               emailAddress:
     *                 type: string
     *                 format: email
     *     responses:
     *       201:
     *         description: User profile updated successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/User'
     *       422:
     *         $ref: '#/components/responses/ValidationError'
     *       500:
     *         description: Server error
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/errorSchema'
     *             examples:
     *               updateUserFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while updating the user."
     *                   error_info:
     *                     module: "user"
     *                     code: 3
     */

    /**
     * @swagger
     * /user/fee-grant:
     *   get:
     *     summary: Allow fee grant for user
     *     description: Enable fee grant for the authenticated user.
     *     tags: [User Management]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Fee grant allowed successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 tx_hash:
     *                   type: string
     *       500:
     *         description: Server error
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/errorSchema'
     *             examples:
     *               findUserFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while finding the user."
     *                   error_info:
     *                     module: "user"
     *                     code: 1
     *               userDoesNotExist:
     *                 value:
     *                   success: false
     *                   message: "User does not exist."
     *                   error_info:
     *                     module: "user"
     *                     code: 2
     *               feeGrantFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while granting fee."
     *                   error_info:
     *                     module: "user"
     *                     code: 20
     *               updateUserFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while updating the user."
     *                   error_info:
     *                     module: "user"
     *                     code: 3
     */

    /**
     * @swagger
     * /user:
     *   post:
     *     summary: Add new users
     *     description: |
     *       Add new users to the system.
     *       Required fields:
     *       - bcAccountAddress
     *       - permissions (array of strings)
     *     tags: [User Management]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               bcAccountAddress:
     *                 type: string
     *               permissions:
     *                 type: array
     *                 items:
     *                   type: string
     *                   enum: [studio, runner, ipfs, streamer]
     *             required:
     *               - bcAccountAddress
     *               - permissions
     *     responses:
     *       200:
     *         description: New user added successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/User'
     *       422:
     *         $ref: '#/components/responses/ValidationError'
     *       500:
     *         description: Server error
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/errorSchema'
     *             examples:
     *               saveUserFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while saving the new user."
     *                   error_info:
     *                     module: "user"
     *                     code: 4
     */

    /**
     * @swagger
     * /user/{id}:
     *   put:
     *     summary: Update user
     *     description: |
     *       Update an existing user's information.
     *       Required fields:
     *       - permissions (array of strings)
     *     tags: [User Management]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               permissions:
     *                 type: array
     *                 items:
     *                   type: string
     *                   enum: [studio, runner, ipfs, streamer]
     *             required:
     *               - permissions
     *     responses:
     *       201:
     *         description: User updated successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/User'
     *       422:
     *         $ref: '#/components/responses/ValidationError'
     *       500:
     *         description: Server error
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/errorSchema'
     *             examples:
     *               findUserFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while checking for existing user."
     *                   error_info:
     *                     module: "user"
     *                     code: 1
     *               updateUserFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while updating the user."
     *                   error_info:
     *                     module: "user"
     *                     code: 3
     *               userDoesNotExist:
     *                 value:
     *                   success: false
     *                   message: "User does not exist."
     *                   error_info:
     *                     module: "user"
     *                     code: 2
     */

    /**
     * @swagger
     * /studio/config:
     *   get:
     *     summary: Get Studio configuration
     *     tags: [Manage Microservices]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Studio configuration retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 status:
     *                   type: number
     *                   example: 200
     *                 result:
     *                   type: object
     *                   description: Studio configuration key-value pairs
     *       422:
     *         $ref: '#/components/responses/ValidationError'
     *       500:
     *         description: Server error
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/errorSchema'
     *             examples:
     *               readConfigFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while reading environment variables"
     *                   error_info:
     *                     module: "manage_ms"
     *                     code: 4
     *               configNotFound:
     *                 value:
     *                   success: false
     *                   message: "Studio backend environment variables not found"
     *                   error_info:
     *                     module: "manage_ms"
     *                     code: 4
     */

    /**
     * @swagger
     * /runner/config:
     *   get:
     *     summary: Get Runner configuration
     *     tags: [Manage Microservices]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Runner configuration retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 status:
     *                   type: number
     *                   example: 200
     *                 result:
     *                   type: object
     *                   description: Studio configuration key-value pairs
     *       422:
     *         $ref: '#/components/responses/ValidationError'
     *       500:
     *         description: Server error
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/errorSchema'
     *             examples:
     *               readConfigFailed:
     *                 value:
     *                   success: false
     *                   message: "Error occurred while reading environment variables"
     *                   error_info:
     *                     module: "manage_ms"
     *                     code: 4
     *               configNotFound:
     *                 value:
     *                   success: false
     *                   message: "Studio runner environment variables not found"
     *                   error_info:
     *                     module: "manage_ms"
     *                     code: 4
     */
};
