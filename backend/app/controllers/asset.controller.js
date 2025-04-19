const async = require('async');
const Axios = require('axios');
const CronJob = require('cron').CronJob;
const {
    DEFAULT_SKIP,
    DEFAULT_LIMIT,
    DESC,
    VIDEO_LINK_EXPIRE_MINUTES,
} = require('../constants');
const { ip, port, publicAddress } = require('../../config/index').runner;
const assetDBO = require('../dbos/asset.dbo');
const assetError = require('../errors/asset.error');
const userDBO = require('../dbos/user.dbo');
const userError = require('../errors/user.error');
const assetHelper = require('../helpers/asset.helper');
const mediaSpaceDBO = require('../dbos/media_space.dbo');
const mediaSpaceError = require('../errors/media_space.error');
const processJSONResponse = require('../utils/response.util');
const { generateSecurePathHash } = require('../utils/auth.util');
const logger = require('../../logger');
const streamReqLogger = require('../../logger/stream_request.logger');
const {
    md5,
    omniflixStudio,
    mediaSpace: mediaSpaceConfig,
} = require('../../config/index');

const getAssets = (req, res) => {
    let {
        sortBy,
        skip,
        limit,
        order,
        total,
        type,
        category,
        genre,
        encode,
        recent,
        days,
        uncategorised,
        search,
        categories,
        genres,
        sources,
        downloadStatus,
        encodeStatus,
        uploadDate,
        publishDate,
        tags,
    } = req.query;
    const { media_space: mediaSpace } = req.user;

    skip = typeof skip === 'undefined' ? DEFAULT_SKIP : parseInt(skip);
    limit = typeof limit === 'undefined' ? DEFAULT_LIMIT : parseInt(limit);

    const conditions = {
        media_space: mediaSpace,
    };
    const options = {
        skip,
        limit,
    };
    if (type) {
        conditions.type = type;
    }
    if (category) {
        conditions.category = category;
    }
    if (genre) {
        conditions.genre = genre;
    }
    if (encode) {
        conditions['file.encode.status'] = encode.toUpperCase();
    }
    if (search) {
        search = search.trim();
        conditions.$or = [{
            name: new RegExp(search, 'mgi'),
        }, {
            'video.name': new RegExp(search, 'mgi'),
        }];
    }
    if (categories) {
        conditions.category = {
            $in: categories,
        };
    }
    if (genres) {
        conditions.genre = {
            $in: genres,
        };
    }
    if (sources) {
        conditions['file.download.source'] = {
            $in: sources,
        };
    }
    if (tags) {
        conditions.tags = {
            $in: tags,
        };
    }
    if (downloadStatus) {
        conditions['file.download.status'] = downloadStatus.toString().toUpperCase();
    }
    if (encodeStatus) {
        conditions['file.encode.status'] = encodeStatus.toString().toUpperCase();
    }
    if (uploadDate) {
        const startDate = new Date(uploadDate);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 1);
        conditions.created_at = {
            $gte: startDate,
            $lt: endDate,
        };
    }
    if (publishDate) {
        const startDate = new Date(uploadDate);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 1);
        conditions.created_at = {
            $gte: startDate,
            $lt: endDate,
        };
    }
    if (sortBy) {
        options.sort = {};
        options.sort[sortBy] = order || -1;
    } else {
        options.sort = {};
        options.sort['created_at'] = DESC;
    }
    if (uncategorised === 'true') {
        conditions.category = {
            $exists: false,
        };
    }
    const now = new Date();
    if (recent) {
        if (!days) {
            days = 7;
        }
        conditions['file.download.at'] = { $gte: new Date(now.setDate(now.getDate() - days)) };
        if (sortBy) {
            options.sort = {};
            options.sort[sortBy] = order || -1;
        } else {
            options.sort = {};
            options.sort['file.download.at'] = DESC;
        }
    }
    async.waterfall([
        (next) => {
            assetDBO.find(conditions, {}, options, true, (error, result) => {
                if (error) {
                    logger.error(error.message);
                    next({
                        error: assetError.findAssetFailed,
                        message: 'Error occurred while finding the assets.',
                    });
                } else {
                    next(null, result || []);
                }
            });
        }, (assets, next) => {
            if (total === 'true') {
                assetDBO.count(conditions, (error, count) => {
                    if (error) {
                        logger.error(error);
                        next({
                            error: assetError.countLiveStreamsFailed,
                            message: 'Error occurred while finding the asset count.',
                        });
                    } else {
                        next(null, {
                            status: 200,
                            result: {
                                list: assets,
                                count,
                            },
                        });
                    }
                });
            } else {
                next(null, {
                    status: 200,
                    result: {
                        list: assets,
                    },
                });
            }
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const getAssetTags = (req, res) => {
    const {
        media_space: mediaSpace,
    } = req.user;
    const {
        type,
        categories,
        genres,
        encode,
    } = req.query;
    const conditions = {
        media_space: mediaSpace,
    };
    if (type) {
        conditions.type = type;
    }
    if (categories) {
        conditions.category = {
            $in: categories,
        };
    }
    if (genres) {
        conditions.genre = {
            $in: genres,
        };
    }
    if (encode) {
        conditions['file.encode.status'] = 'COMPLETE';
    }
    async.waterfall([
        (next) => {
            assetDBO.find(conditions, {
                tags: 1,
            }, {}, false, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: assetError.findAssetFailed,
                        message: 'Error occurred while finding the assets.',
                    });
                } else {
                    next(null, result);
                }
            });
        }, (items, next) => {
            let result = [];
            items.forEach((item) => {
                item.tags.forEach((tag) => {
                    result.push(tag);
                });
            });
            result = [...new Set(result)];
            next(null, {
                status: 200,
                result,
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const addAsset = (req, res) => {
    const {
        _id,
        media_space: mediaSpace,
    } = req.user;
    let {
        type,
        customId,
        trackName,
        name,
        duration,
        isrcCode,
        ownershipStatus,
        language,
        category,
        genre,
        videoType,
        description,
        tags,
        file,
        horizontalThumbnail,
        verticalThumbnail,
        squareThumbnail,
        horizontalCompressedThumbnail,
        verticalCompressedThumbnail,
        squareCompressedThumbnail,
    } = req.body;

    const doc = {
        type,
        added_by: _id,
        media_space: mediaSpace,
    };
    type = type.toLowerCase();
    if (type === 'video') {
        doc.video = {};
        if (customId) {
            doc.custom_id = customId;
        }
        if (language) {
            doc.language = language;
        }
        if (category) {
            doc.category = category;
        }
        if (genre) {
            doc.genre = genre;
        }
        if (tags) {
            doc.tags = tags;
        }
        if (description) {
            doc.description = description;
        }
        if (trackName) {
            doc.video.name = trackName;
            doc.name = trackName;
        }
        if (name) {
            doc.video.name = name;
            doc.name = name;
        }
        if (ownershipStatus) {
            doc.video.ownership_status = ownershipStatus;
        }
        if (videoType) {
            doc.video.video_type = videoType;
        }
        if (file) {
            doc.file = {
                download: {},
            };
            if (file.source) {
                doc.file.download.source = file.source;
            }
            if (file.id) {
                doc.file.download.id = file.id;
            }
        }
        doc.thumbnail = {};
        if (horizontalThumbnail) {
            doc.thumbnail.horizontal = horizontalThumbnail;
        }
        if (verticalThumbnail) {
            doc.thumbnail.vertical = verticalThumbnail;
        }
        if (squareThumbnail) {
            doc.thumbnail.square = squareThumbnail;
        }
        if (horizontalCompressedThumbnail) {
            doc.thumbnail.horizontal_compressed = horizontalCompressedThumbnail;
        }
        if (verticalCompressedThumbnail) {
            doc.thumbnail.vertical_compressed = verticalCompressedThumbnail;
        }
        if (squareCompressedThumbnail) {
            doc.thumbnail.square_compressed = squareCompressedThumbnail;
        }
    } else if (type === 'audio') {
        doc.audio = {};
        if (customId) {
            doc.custom_id = customId;
        }
        if (language) {
            doc.language = language;
        }
        if (category) {
            doc.category = category;
        }
        if (genre) {
            doc.genre = genre;
        }
        if (tags) {
            doc.tags = tags;
        }
        if (description) {
            doc.description = description;
        }
        if (trackName) {
            doc.audio.name = trackName;
            doc.name = trackName;
        }
        if (name) {
            doc.audio.name = name;
            doc.name = name;
        }
        if (duration) {
            doc.audio.duration = duration;
        }
        if (ownershipStatus) {
            doc.audio.ownership_status = ownershipStatus;
        }
        if (isrcCode) {
            doc.audio.isrc_code = isrcCode;
        }
        if (file) {
            doc.file = {
                download: {},
            };
            if (file.source) {
                doc.file.download.source = file.source;
            }
            if (file.id) {
                doc.file.download.id = file.id;
            }
        }
        doc.thumbnail = {};
        if (horizontalThumbnail) {
            doc.thumbnail.horizontal = horizontalThumbnail;
        }
        if (verticalThumbnail) {
            doc.thumbnail.vertical = verticalThumbnail;
        }
        if (squareThumbnail) {
            doc.thumbnail.square = squareThumbnail;
        }
        if (horizontalCompressedThumbnail) {
            doc.thumbnail.horizontal_compressed = horizontalCompressedThumbnail;
        }
        if (verticalCompressedThumbnail) {
            doc.thumbnail.vertical_compressed = verticalCompressedThumbnail;
        }
        if (squareCompressedThumbnail) {
            doc.thumbnail.square_compressed = squareCompressedThumbnail;
        }
    }

    async.waterfall([
        (next) => {
            if (customId) {
                assetDBO.findOne({
                    custom_id: customId,
                }, {
                    _id: 1,
                }, {}, false, (error, result) => {
                    if (error) {
                        logger.error(error);
                        next({
                            error: assetError.findAssetFailed,
                            message: 'Error occurred while finding the asset.',
                        });
                    } else if (result) {
                        next({
                            status: 400,
                            error: assetError.assetAlreadyExist,
                            message: 'Asset already exist.',
                        });
                    } else {
                        next(null);
                    }
                });
            } else {
                next(null);
            }
        }, (next) => {
            assetDBO.save(doc, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    console.log(error);
                    next({
                        error: assetError.saveAssetFailed,
                        message: 'Error occurred while saving the asset.',
                    });
                } else {
                    result = result.toObject();
                    delete (result['created_at']);
                    delete (result['updated_at']);
                    delete (result.__v);

                    next(null, result);
                }
            });
        }, (asset, next) => {
            if (file) {
                const data = {
                    source: file.source,
                    id: file.id,
                    file: asset._id,
                    destination: type,
                };
                next(null, data, asset._id);
            } else {
                next({
                    success: true,
                    status: 201,
                    result: asset,
                });
            }
        }, (data, assetId, next) => {
            const url = `http://${ip}:${port}/runner/users/${_id}/assets/${assetId}/file`;

            Axios({
                method: 'post',
                url,
                data,
            }).then((res) => {
                if (res.data && res.data.success) {
                    next(null, assetId, data);
                } else {
                    logger.error(res.data);
                    let msg = 'Error occurred while requesting the runner.';
                    if (res.data.error && res.data.error.message) {
                        msg = res.data.error.message;
                    }
                    next({
                        error: assetError.requestRunnerFailed,
                        message: msg,
                    });
                }
            }).catch((error) => {
                logger.error(error);
                next({
                    error: assetError.requestRunnerFailed,
                    message: 'Error occurred while requesting the runner.',
                });
            });
        }, (id, data, next) => {
            const set = {
                'file.download.source': data.source,
                'file.download.id': data.id,
                'file.download.path': data.path,
            };
            if (data.source === 'youtube') {
                set['file.download.status'] = 'IN_QUEUE';
            }
            assetDBO.findOneAndUpdate({
                _id: id,
            }, {
                $set: set,
            }, {
                new: true,
            }, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: assetError.updateAssetFailed,
                        message: 'Error occurred while updating the asset.',
                    });
                } else {
                    delete (result['created_at']);
                    delete (result['updated_at']);
                    delete (result.__v);

                    next(null, {
                        status: 200,
                        result,
                    });
                }
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const getAsset = (req, res) => {
    const { id } = req.params;

    async.waterfall([
        (next) => {
            assetDBO.findOne({
                _id: id,
            }, {}, {}, true, (error, result) => {
                if (error) {
                    logger.error(error.message);
                    next({
                        error: assetError.findAssetFailed,
                        message: 'Error occurred while finding the asset.',
                    });
                } else if (result) {
                    next(null, {
                        status: 200,
                        result,
                    });
                } else {
                    next({
                        status: 404,
                        error: assetError.assetDoesNotExist,
                        message: 'Asset does not exist.',
                    });
                }
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const updateAsset = (req, res) => {
    const { id } = req.params;
    const {
        _id,
        media_space: mediaSpace,
    } = req.user;
    let {
        type,
        customId,
        trackName,
        name,
        duration,
        isrcCode,
        ownershipStatus,
        album,
        recordLabel,
        language,
        category,
        genre,
        videoType,
        tags,
        description,
        cast,
        producers,
        directors,
        musicDirectors,
        musicComposers,
        singers,
        lyricists,
        cinematography,
        artDirectors,
        costumeDesigners,
        crew,
        screenPlay,
        story,
        dialogues,
        computerGraphics,
        stylists,
        editors,
        distributionPlatforms,
        censorTerritory,
        censorCertificateGrade,
        releaseDate,
        popularity,
        mood,
        file,
        horizontalThumbnail,
        verticalThumbnail,
        squareThumbnail,
        horizontalCompressedThumbnail,
        verticalCompressedThumbnail,
        squareCompressedThumbnail,
    } = req.body;

    const set = {};

    type = type.toLowerCase();
    if (type === 'video') {
        if (customId) {
            set.custom_id = customId;
        }
        if (language) {
            set.language = language;
        }
        if (category) {
            set.category = category;
        }
        if (genre) {
            set.genre = genre;
        }
        if (tags) {
            set.tags = tags;
        }
        if (description) {
            set.description = description;
        }
        if (trackName) {
            set['video.name'] = trackName;
            set.name = trackName;
        }
        if (name) {
            set['video.name'] = name;
            set.name = name;
        }
        if (duration) {
            set['video.duration'] = duration;
        }
        if (ownershipStatus) {
            set['video.ownership_status'] = ownershipStatus;
        }
        if (isrcCode) {
            set['video.isrc_code'] = isrcCode;
        }
        if (album) {
            set['video.album'] = album;
        }
        if (recordLabel) {
            set['video.record_label'] = recordLabel;
        }
        if (videoType) {
            set['video.video_type'] = videoType;
        }
        if (cast) {
            set['video.cast'] = cast;
        }
        if (producers) {
            set['video.producers'] = producers;
        }
        if (directors) {
            set['video.directors'] = directors;
        }
        if (cinematography) {
            set['video.cinematography'] = cinematography;
        }
        if (artDirectors) {
            set['video.art_directors'] = artDirectors;
        }
        if (costumeDesigners) {
            set['video.costume_designers'] = costumeDesigners;
        }
        if (musicDirectors) {
            set['video.music_directors'] = musicDirectors;
        }
        if (musicComposers) {
            set['video.music_composers'] = musicComposers;
        }
        if (singers) {
            set['video.singers'] = singers;
        }
        if (lyricists) {
            set['video.lyricists'] = lyricists;
        }
        if (crew) {
            set['video.crew'] = crew;
        }
        if (screenPlay) {
            set['video.screen_play'] = screenPlay;
        }
        if (story) {
            set['video.story'] = story;
        }
        if (dialogues) {
            set['video.dialogues'] = dialogues;
        }
        if (computerGraphics) {
            set['video.computer_graphics'] = computerGraphics;
        }
        if (stylists) {
            set['video.stylists'] = stylists;
        }
        if (editors) {
            set['video.editors'] = editors;
        }
        if (distributionPlatforms) {
            set['video.distribution_platforms'] = distributionPlatforms;
        }
        if (censorTerritory) {
            set['video.censor_territory'] = censorTerritory;
        }
        if (censorCertificateGrade) {
            set['video.censor_certificate_grade'] = censorCertificateGrade;
        }
        if (releaseDate) {
            set['video.release_date'] = releaseDate;
        }
        if (mood) {
            set['video.mood'] = mood;
        }
        if (file) {
            set.file = {
                download: {},
            };
            if (file.source) {
                set.file.download.source = file.source;
            }
            if (file.id) {
                set.file.download.id = file.id;
            }
        }
        if (horizontalThumbnail) {
            set['thumbnail.horizontal'] = horizontalThumbnail;
        }
        if (verticalThumbnail) {
            set['thumbnail.vertical'] = verticalThumbnail;
        }
        if (squareThumbnail) {
            set['thumbnail.square'] = squareThumbnail;
        }
        if (horizontalCompressedThumbnail) {
            set['thumbnail.horizontal_compressed'] = horizontalCompressedThumbnail;
        }
        if (verticalCompressedThumbnail) {
            set['thumbnail.vertical_compressed'] = verticalCompressedThumbnail;
        }
        if (squareCompressedThumbnail) {
            set['thumbnail.square_compressed'] = squareCompressedThumbnail;
        }
    } else if (type === 'audio') {
        if (customId) {
            set.custom_id = customId;
        }
        if (language) {
            set.language = language;
        }
        if (category) {
            set.category = category;
        }
        if (genre) {
            set.genre = genre;
        }
        if (tags) {
            set.tags = tags;
        }
        if (description) {
            set.description = description;
        }
        if (trackName) {
            set['audio.name'] = trackName;
            set.name = trackName;
        }
        if (name) {
            set['audio.name'] = name;
            set.name = name;
        }
        if (ownershipStatus) {
            set['audio.ownership_status'] = ownershipStatus;
        }
        if (isrcCode) {
            set['audio.isrc_code'] = isrcCode;
        }
        if (album) {
            set['audio.album'] = album;
        }
        if (recordLabel) {
            set['audio.record_label'] = recordLabel;
        }
        if (cast) {
            set['audio.cast'] = cast;
        }
        if (musicDirectors) {
            set['audio.music_directors'] = musicDirectors;
        }
        if (musicComposers) {
            set['audio.music_composers'] = musicComposers;
        }
        if (singers) {
            set['audio.singers'] = singers;
        }
        if (lyricists) {
            set['audio.lyricists'] = lyricists;
        }
        if (popularity) {
            set['audio.popularity'] = popularity;
        }
        if (mood) {
            set['audio.mood'] = mood;
        }
        if (file) {
            set.file = {
                download: {},
            };
            if (file.source) {
                set.file.download.source = file.source;
            }
            if (file.id) {
                set.file.download.id = file.id;
            }
        }
        if (horizontalThumbnail) {
            set['thumbnail.horizontal'] = horizontalThumbnail;
        }
        if (verticalThumbnail) {
            set['thumbnail.vertical'] = verticalThumbnail;
        }
        if (squareThumbnail) {
            set['thumbnail.square'] = squareThumbnail;
        }
        if (horizontalCompressedThumbnail) {
            set['thumbnail.horizontal_compressed'] = horizontalCompressedThumbnail;
        }
        if (verticalCompressedThumbnail) {
            set['thumbnail.vertical_compressed'] = verticalCompressedThumbnail;
        }
        if (squareCompressedThumbnail) {
            set['thumbnail.square_compressed'] = squareCompressedThumbnail;
        }
    }

    async.waterfall([
        (next) => {
            assetDBO.findOneAndUpdate({
                _id: id,
                media_space: mediaSpace,
            }, {
                $set: set,
            }, {
                new: true,
            }, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: assetError.updateAssetFailed,
                        message: 'Error occurred while updating the asset.',
                    });
                } else if (result) {
                    next(null, result);
                } else {
                    next({
                        status: 404,
                        error: assetError.assetDoesNotExist,
                        message: ' Asset does not exist.',
                    });
                }
            });
        }, (asset, next) => {
            if (file) {
                const data = {
                    source: file.source,
                    id: file.id,
                    file: asset._id,
                    destination: asset.type,
                };
                next(null, data, asset._id);
            } else {
                next({
                    success: true,
                    status: 200,
                    result: asset,
                });
            }
        }, (data, assetId, next) => {
            const url = `http://${ip}:${port}/runner/users/${_id}/assets/${assetId}/file`;
            Axios({
                method: 'post',
                url,
                data,
            }).then((res) => {
                if (res.data && res.data.success) {
                    next(null, data.file, data.destination);
                } else {
                    logger.error(res.data);
                    let msg = 'Error occurred while requesting the runner.';
                    if (res.data.error && res.data.error.message) {
                        msg = res.data.error.message;
                    }
                    next({
                        error: assetError.requestRunnerFailed,
                        message: msg,
                    });
                }
            }).catch((error) => {
                logger.error(error);
                next({
                    error: assetError.requestRunnerFailed,
                    message: 'Error occurred while requesting the runner.',
                });
            });
        }, (file, path, next) => {
            assetDBO.findOneAndUpdate({
                _id: id,
            }, {
                $set: {
                    'file.download.source': file.source,
                    'file.download.id': file.id,
                    'file.download.path': path,
                },
            }, {
                new: true,
            }, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: assetError.updateAssetFailed,
                        message: 'Error occurred while updating the asset.',
                    });
                } else {
                    delete (result['created_at']);
                    delete (result['updated_at']);
                    delete (result.__v);

                    next(null, {
                        status: 200,
                        result,
                    });
                }
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const updateAssetFile = (req, res) => {
    const { id } = req.params;
    const {
        file,
        thumbnail,
    } = req.body;

    const updates = {};
    if (file) {
        if (file.name) {
            updates['file.name'] = file.name;
        }
        if (file.size !== undefined) {
            updates['file.size'] = file.size;
        }
        if (file.path) {
            updates['file.path'] = file.path;
        }
        if (file.MIMEType) {
            updates['file.MIME_type'] = file.MIMEType;
        }
        if (file.duration !== undefined) {
            updates['file.duration'] = file.duration;
        }
        if (file.length !== undefined) {
            updates['file.length'] = file.length;
        }
        if (file.IPFSHash) {
            updates['file.IPFS_hash'] = file.IPFSHash;
        }
        if (file.previewIPFSHash) {
            updates['file.preview_IPFS_hash'] = file.previewIPFSHash;
        }
        if (file.status) {
            updates['file.status'] = file.status;
        }
    }
    if (thumbnail) {
        if (thumbnail.horizontalThumbnail) {
            updates['thumbnail.horizontal'] = thumbnail.horizontalThumbnail;
        }
        if (thumbnail.verticalThumbnail) {
            updates['thumbnail.vertical'] = thumbnail.verticalThumbnail;
        }
        if (thumbnail.squareThumbnail) {
            updates['thumbnail.square'] = thumbnail.squareThumbnail;
        }
        if (thumbnail.horizontalCompressedThumbnail) {
            updates['thumbnail.horizontal_compressed'] = thumbnail.horizontalCompressedThumbnail;
        }
        if (thumbnail.verticalCompressedThumbnail) {
            updates['thumbnail.vertical_compressed'] = thumbnail.verticalCompressedThumbnail;
        }
        if (thumbnail.squareCompressedThumbnail) {
            updates['thumbnail.square_compressed'] = thumbnail.squareCompressedThumbnail;
        }
    }

    async.waterfall([
        (next) => {
            assetDBO.findOneAndUpdate({
                _id: id,
            }, {
                $set: updates,
            }, {
                new: true,
            }, false, (error, result) => {
                if (error) {
                    logger.error(error.message);
                    next({
                        error: assetError.updateAssetFailed,
                        message: 'Error occurred while updating the asset.',
                    });
                } else if (result) {
                    next(null, {
                        status: 200,
                        result,
                    });
                } else {
                    next({
                        status: 404,
                        error: assetError.assetDoesNotExist,
                        message: 'Asset does not exist.',
                    });
                }
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const deleteAsset = (req, res) => {
    const { id } = req.params;
    const {
        _id,
        media_space: mediaSpace,
    } = req.user;
    const {
        source,
        encoded,
    } = req.query;

    async.waterfall([
        (next) => {
            assetDBO.findOne({
                _id: id,
                media_space: mediaSpace,
            }, {
                'file.encode': 1,
                'file.download': 1,
                'file.name': 1,
            }, {}, false, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: assetError.findAssetFailed,
                        message: 'Error occurred while finding the asset.',
                    });
                } else if (result) {
                    if (result.file.download.status === 'COMPLETE') {
                        next(null, true, result.file, result._id, result.is_default_asset);
                    } else {
                        next(null, false, result.file, result._id, result.is_default_asset);
                    }
                } else {
                    logger.error(error);
                    next({
                        error: assetError.assetDoesNotExist,
                        message: 'Asset does not exist.',
                    });
                }
            });
        }, (fileExists, file, AssetId, isDefaultAsset, next) => {
            if (fileExists && !isDefaultAsset) {
                const url = `http://${ip}:${port}/runner/users/${_id}/assets/${AssetId}/delete`;
                const data = {};
                if (source && file.download.path) {
                    data.sourcePath = file.download.path + '/' + file.name;
                } else if (source && file.path) {
                    data.sourcePath = file.path + '/' + file.name;
                }
                if (encoded && file.encode.path) {
                    data.encodedPath = file.encode.path;
                }
                Axios({
                    method: 'post',
                    url,
                    data,
                }).then(() => {
                    next(null);
                }).catch((error) => {
                    logger.error(error.message);
                    next({
                        error: assetError.requestRunnerFailed,
                        message: 'Error occurred while requesting the runner.',
                    });
                });
            } else {
                next(null);
            }
        }, (next) => {
            if (source && encoded) {
                assetDBO.findOneAndDelete({
                    _id: id,
                }, {}, false, (error) => {
                    if (error) {
                        logger.error(error);
                        next({
                            error: assetError.deleteAssetFailed,
                            message: 'Error occurred while deleting the asset.',
                        });
                    } else {
                        next(null, {
                            status: 200,
                        });
                    }
                });
            } else if (!source && encoded) {
                assetDBO.findOneAndUpdate({
                    _id: id,
                }, {
                    $set: {
                        'file.encode.status': 'PENDING',
                        'file.encode.path': '',
                    },
                }, {
                    new: true,
                }, false, (error, asset) => {
                    if (error) {
                        logger.error(error);
                        next({
                            error: assetError.updateAssetFailed,
                            message: 'Error occurred while updating the asset.',
                        });
                    } else {
                        next(null, {
                            status: 200,
                        });
                    }
                });
            } else if (!encoded && source) {
                assetDBO.findOneAndUpdate({
                    _id: id,
                }, {
                    $set: {
                        'file.download.status': 'NO_SOURCE',
                        'file.download.path': null,
                    },
                }, {
                    new: true,
                }, false, (error, asset) => {
                    if (error) {
                        logger.error(error);
                        next({
                            error: assetError.updateAssetFailed,
                            message: 'Error occurred while updating the asset.',
                        });
                    } else {
                        next(null, {
                            status: 200,
                        });
                    }
                });
            } else {
                next(null, {
                    status: 200,
                });
            }
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const encodeAsset = (req, res) => {
    const { id } = req.params;
    const {
        _id,
        media_space: mediaSpace,
    } = req.user;
    async.waterfall([
        (next) => {
            assetDBO.findOne({
                _id: id,
                'file.download.status': 'COMPLETE',
                'file.encode.status': {
                    $nin: ['IN_PROGRESS', 'IN_QUEUE'],
                },
                type: 'video',
                media_space: mediaSpace,
            }, {
                file: 1,
            }, {}, true, (error, asset) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: assetError.findAssetFailed,
                        message: 'Error occurred while finding the asset.',
                    });
                } else if (asset) {
                    next(null, asset);
                } else {
                    next({
                        status: 400,
                        error: assetError.assetDoesNotExist,
                        message: 'Asset does not exist or invalid file download status or invalid file type',
                    });
                }
            });
        }, (asset, next) => {
            const url = `http://${ip}:${port}/runner/users/${_id}/assets/${asset._id}/encode`;
            const data = {
                path: asset.file.download.path ? `${asset.file.download.path}/${asset.file.name}` : `${asset.file.path}/${asset.file.name}`,
                segmentDuration: asset.file.encode['segment_duration'],
            };

            Axios({
                method: 'post',
                url,
                data,
            }).then((res) => {
                if (res.data && res.data.success) {
                    next(null, asset);
                } else {
                    logger.error(res.data);
                    let msg = 'Error occurred while requesting the runner.';
                    if (res.data.error && res.data.error.message) {
                        msg = res.data.error.message;
                    }
                    next({
                        error: assetError.requestRunnerFailed,
                        message: msg,
                    });
                }
            }).catch((error) => {
                logger.error(error);
                next({
                    error: assetError.requestRunnerFailed,
                    message: 'Error occurred while requesting the runner.',
                });
            });
        }, (asset, next) => {
            assetDBO.findOneAndUpdate({
                _id: asset._id,
            }, {
                $set: {
                    'file.encode.status': 'IN_QUEUE',
                },
            }, {
                new: true,
            }, false, (error, asset) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: assetError.updateAssetFailed,
                        message: 'Error occurred while updating the asset.',
                    });
                } else {
                    next(null, {
                        status: 200,
                        result: asset,
                    });
                }
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const getAssetsOverview = (req, res) => {
    const { encode } = req.query;

    async.waterfall([
        (next) => {
            const pipeline = assetHelper.getAssetsOverviewPipeline(encode);
            next(null, pipeline);
        }, (pipeline, next) => {
            assetDBO.aggregate(pipeline, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: assetError.overviewAssetsFailed,
                        message: 'Error occurred while finding the assets type-wise count.',
                    });
                } else {
                    next(null, result);
                }
            });
        }, (data, next) => {
            const result = [];
            const mediaTypes = ['video', 'audio'];
            data.forEach((item) => {
                result.push({
                    type: item._id,
                    count: item.count,
                });
            });
            const types = result.map((item) => item.type);
            const remainingTypes = mediaTypes.filter((type) => types.indexOf(type) === -1);
            remainingTypes.forEach((type) => {
                result.push({
                    type,
                    count: 0,
                });
            });
            next(null, {
                status: 200,
                result,
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const addRunnerAssets = (req, res) => {
    const { userId, name, file } = req.body;

    const doc = {
        'file.download.status': 'COMPLETE',
        'file.download.at': new Date(),
        created_by: userId,
    };
    if (name) {
        doc.name = name;
    }
    if (file.name) {
        doc['file.name'] = file.name;
    }
    if (file.size) {
        doc['file.size'] = file.size;
    }
    if (file.MIMEType) {
        doc['file.MIME_type'] = file.MIMEType;
        const mediaType = file.MIMEType.split('/')[0].toString();
        doc.type = mediaType;
        if (mediaType === 'audio') {
            doc.audio = {};
            if (file.trackName) {
                doc.audio.name = file.trackName;
                doc.name = file.trackName;
            }
            if (file.assetName) {
                doc.audio.name = file.assetName;
                doc.name = file.assetName;
            }
            if (file.duration) {
                doc.audio.duration = file.duration;
            }
            if (file.ownershipStatus) {
                doc.audio.ownership_status = file.ownershipStatus;
            }
        }
        if (mediaType === 'video') {
            doc.video = {};
            if (file.trackName) {
                doc.video.name = file.trackName;
                doc.name = file.trackName;
            }
            if (file.assetName) {
                doc.video.name = file.assetName;
                doc.name = file.assetName;
            }
            if (file.ownershipStatus) {
                doc.video.ownership_status = file.ownershipStatus;
            }
            if (file.videoType) {
                doc.video.video_type = file.videoType;
            }
        }
    }
    if (file.length) {
        doc['file.length'] = file.length;
    }
    if (file.path) {
        doc['file.download.path'] = file.path;
    }
    if (file.source) {
        doc['file.download.source'] = file.source;
    }
    if (file.category) {
        doc.category = file.category;
    }
    if (file.genre) {
        doc.genre = file.genre;
    }
    if (file.tags) {
        doc.tags = file.tags;
    }
    doc.thumbnail = {};
    if (file.thumbnail && file.thumbnail.horizontalThumbnail) {
        doc.thumbnail.horizontal = file.thumbnail.horizontalThumbnail;
    }
    if (file.thumbnail && file.thumbnail.verticalThumbnail) {
        doc.thumbnail.vertical = file.thumbnail.verticalThumbnail;
    }
    if (file.thumbnail && file.thumbnail.squareThumbnail) {
        doc.thumbnail.square = file.thumbnail.squareThumbnail;
    }
    if (file.thumbnail && file.thumbnail.horizontalCompressedThumbnail) {
        doc.thumbnail.horizontal_compressed = file.thumbnail.horizontalCompressedThumbnail;
    }
    if (file.thumbnail && file.thumbnail.verticalCompressedThumbnail) {
        doc.thumbnail.vertical_compressed = file.thumbnail.verticalCompressedThumbnail;
    }
    if (file.thumbnail && file.thumbnail.squareCompressedThumbnail) {
        doc.thumbnail.square_compressed = file.thumbnail.horizontalThumbnail;
    }

    async.waterfall([
        (next) => {
            userDBO.findOne({
                _id: userId,
            }, {
                media_space: 1,
            }, {}, false, (error, result) => {
                if (error) {
                    next({
                        error: userError.findUserFailed,
                        message: 'Error occurred while finding the user.',
                    });
                } else if (result) {
                    doc.media_space = result.media_space;
                    next(null);
                } else {
                    next({
                        error: userError.userDoesNotExist,
                        message: 'User does not exist.',
                    });
                }
            });
        }, (next) => {
            assetDBO.save(doc, false, (error, result) => {
                if (error) {
                    logger.error(error.message, error);
                    next({
                        error: assetError.saveAssetFailed,
                        message: 'Error occurred while saving the asset.',
                    });
                } else {
                    next(null, {
                        status: 200,
                        result,
                    });
                }
            });
        },
    ], (error, result) => {
        if (error) {
            logger.error(error);
        }
        processJSONResponse(res, error, result);
    });
};

const updateRunnerAsset = (req, res) => {
    const {
        id,
    } = req.params;
    const {
        name,
        source,
        file,
        downloadPath,
        downloadStatus,
        encodeStatus,
        encodeSegments,
        encodePath,
        thumbnail,
        duration,
    } = req.body;
    const set = {
        'file.download.status': 'COMPLETE',
        'file.download.at': new Date(),
    };
    if (file) {
        if (file.name) {
            set['file.name'] = file.name;
        }
        if (file.path) {
            set['file.path'] = file.path;
        }
        if (file.size) {
            set['file.size'] = file.size;
        }
        if (file.encodedFileIPFSHash) {
            set['file.encode.encoded_file_ipfs_hash'] = file.encodedFileIPFSHash;
        }
        if (file.length) {
            set['file.length'] = file.length;
        }
        if (file.duration) {
            set['file.duration'] = file.duration;
        }
        if (file.MIMEType) {
            set['file.MIME_type'] = file.MIMEType;
        }
        if (file.IPFSHash) {
            set['file.IPFS_hash'] = file.IPFSHash;
        }
        if (file.previewIPFSHash) {
            set['file.preview_IPFS_hash'] = file.previewIPFSHash;
        }
        if (file.status) {
            set['file.status'] = file.status;
        }

        if (file.thumbnail && file.thumbnail.horizontalThumbnail) {
            set['thumbnail.horizontal'] = file.thumbnail.horizontalThumbnail;
        }
        if (file.thumbnail && file.thumbnail.verticalThumbnail) {
            set['thumbnail.vertical'] = thumbnail.verticalThumbnail;
        }
        if (file.thumbnail && file.thumbnail.squareThumbnail) {
            set['thumbnail.square'] = file.thumbnail.squareThumbnail;
        }
        if (file.thumbnail && file.thumbnail.horizontalCompressedThumbnail) {
            set['thumbnail.horizontal_compressed'] = file.thumbnail.horizontalCompressedThumbnail;
        }
        if (file.thumbnail && file.thumbnail.verticalCompressedThumbnail) {
            set['thumbnail.vertical_compressed'] = file.thumbnail.verticalCompressedThumbnail;
        }
        if (file.thumbnail && file.thumbnail.squareCompressedThumbnail) {
            set['thumbnail.square_compressed'] = file.thumbnail.squareCompressedThumbnail;
        }
    }
    if (name) {
        set.name = name;
    }
    if (duration) {
        set.duration = duration;
    }
    if (source) {
        set['file.download.source'] = source;
    }
    if (downloadStatus) {
        set['file.download.status'] = downloadStatus;
        set['file.download.at'] = new Date();
    }
    if (encodeStatus) {
        set['file.encode.status'] = encodeStatus;
        set['file.encode.at'] = new Date();
    }
    if (downloadPath) {
        set['file.download.path'] = downloadPath;
    }
    if (encodePath) {
        set['file.encode.path'] = encodePath;
    }
    if (encodeSegments && encodeSegments.length) {
        set['file.encode.segments'] = [];
        for (let i = 0; i < encodeSegments.length; i++) {
            set['file.encode.segments'].push({
                start_at: encodeSegments[i].startAt,
                end_at: encodeSegments[i].endAt,
            });
        }
    }
    async.waterfall([
        (next) => {
            console.log(set);
            assetDBO.findOneAndUpdate({
                _id: id,
            }, {
                $set: set,
            }, {
                new: true,
            }, false, (error, result) => {
                if (error) {
                    logger.error(error);
                    console.log(error);
                    next({
                        error: assetError.updateAssetFailed,
                        message: 'Error occurred while updating the asset.',
                    });
                } else if (result) {
                    next(null, {
                        status: 200,
                        result,
                    });
                } else {
                    next({
                        status: 404,
                        error: assetError.assetDoesNotExist,
                        message: 'Asset Does not exist.',
                    });
                }
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const getAssetWatchURL = (req, res) => {
    const {
        id,
    } = req.params;
    let {
        deviceId,
    } = req.query;

    deviceId = deviceId.trim();
    async.waterfall([
        (next) => {
            assetDBO.findOne({
                _id: id,
            }, {
                __v: 0,
                updated_at: 0,
            }, {}, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: assetError.findAssetFailed,
                        message: 'Error occurred while finding the asset.',
                    });
                } else if (result) {
                    if (result.file.encode && result.file.encode.status === 'COMPLETE' && result.file.encode.path) {
                        const baseURL = `https://${publicAddress}`;
                        next(null, baseURL, result);
                    } else {
                        if (result.type === 'audio' && result.file.download && result.file.download.status === 'COMPLETE') {
                            const baseURL = `https://${publicAddress}`;
                            next(null, baseURL, result);
                        } else {
                            next({
                                status: 404,
                                error: assetError.assetDoesNotExist,
                                message: 'Asset does not exist / not encoded.',
                            });
                        }
                    }
                } else {
                    next({
                        status: 404,
                        error: assetError.assetDoesNotExist,
                        message: 'Asset does not exist.',
                    });
                }
            });
        }, (baseURL, asset, next) => {
            const expiresTimestamp = new Date(Date.now() + (1000 * 60 * VIDEO_LINK_EXPIRE_MINUTES)).getTime();
            const expires = String(Math.round(expiresTimestamp / 1000));
            const token = generateSecurePathHash(expires, deviceId, md5.secret);
            let assetUrl;

            let filePath = asset.file.encode.path || asset.file.download.path + '/' + asset.file.name || 'not-exist';
            if (filePath.startsWith('/')) {
                filePath = filePath.slice(1);
            }
            if (asset.type === 'video' && asset.file.encode.path.endsWith('playlist.m3u8')) {
                assetUrl = `${baseURL}/video/${id}/${token}/${expires}/${deviceId}/playlist.m3u8`;
            } else if (asset.type === 'audio') {
                assetUrl = `${baseURL}/hls/sources/${filePath}`;
            } else {
                assetUrl = `${baseURL}/hls/${filePath.replace('.mp4', '.m3u8')}`;
            }
            streamReqLogger.info(JSON.stringify({
                app: 'Studio_Public',
                asset: asset._id,
                ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
                device: deviceId,
                request_time: (new Date()),
                token,
            }));
            next(null, {
                status: 201,
                result: {
                    assetUrl: assetUrl,
                },
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const addScriptAsset = (req, res) => {
    let {
        type,
        name,
        user_id: userId,
    } = req.body;

    const doc = {
        type,
        added_by: userId,
    };
    type = type.toLowerCase();
    if (type === 'video') {
        doc.video = {};
        if (name) {
            doc.video.name = name;
            doc.name = name;
        }
    }

    async.waterfall([
        (next) => {
            userDBO.findOne({
                _id: userId,
            }, {
                media_space: 1,
            }, {}, false, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: userError.findUserFailed,
                        message: 'Error occurred while finding the user.',
                    });
                } else if (result) {
                    doc.media_space = result.media_space;
                    next(null);
                } else {
                    next({
                        error: userError.userDoesNotExist,
                        message: 'User does not exist.',
                    });
                }
            });
        }, (next) => {
            assetDBO.save(doc, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    console.log(error);
                    next({
                        error: assetError.saveAssetFailed,
                        message: 'Error occurred while saving the asset.',
                    });
                } else {
                    next(null, {
                        status: 200,
                        result,
                    });
                }
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const updateScriptAsset = (req, res) => {
    const { id } = req.params;
    const {
        encodePath,
        encodeStatus,
        encodeSegments,
    } = req.body;

    const set = {
        file: {
            encode: {
                path: encodePath,
                status: encodeStatus,
            },
        },
    };

    if (encodeSegments && encodeSegments.length) {
        set.file.encode.segments = [];
        for (let i = 0; i < encodeSegments.length; i++) {
            set.file.encode.segments.push({
                start_at: encodeSegments[i].startAt,
                end_at: encodeSegments[i].endAt,
            });
        }
    }

    async.waterfall([
        (next) => {
            assetDBO.findOneAndUpdate({
                _id: id,
            }, {
                $set: set,
            }, {
                new: true,
            }, false, (error, result) => {
                if (error) {
                    logger.error(error.message);
                    next({
                        error: assetError.updateAssetFailed,
                        message: 'Error occurred while updating the asset.',
                    });
                } else if (result) {
                    next(null, {
                        status: 200,
                        result,
                    });
                } else {
                    next({
                        status: 404,
                        error: assetError.assetDoesNotExist,
                        message: 'Asset does not exist.',
                    });
                }
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const updateAssetCountToStudio = (cb) => {
    async.waterfall([
        (next) => {
            mediaSpaceDBO.findOne({
                username: 'main',
            }, {}, {}, false, (error, result) => {
                if (error) {
                    next({
                        error: mediaSpaceError.findMediaSpaceFailed,
                        message: 'Error occurred while finding the media space.',
                    });
                } else if (result) {
                    if (mediaSpaceConfig.forLease === 'true' && !result.lease) {
                        next({
                            error: mediaSpaceError.mediaSpaceDoesNotExist,
                            message: 'Lease does not exist for the media space.',
                        });
                    } else {
                        next(null, result);
                    }
                } else {
                    next({
                        error: mediaSpaceError.mediaSpaceDoesNotExist,
                        message: 'Media space does not exist.',
                    });
                }
            });
        }, (mediaSpace, next) => {
            const conditions = {
                is_admin: true,
            };
            if (mediaSpaceConfig.forLease === 'true' && mediaSpace.lease) {
                conditions._id = mediaSpace.lease.lessee;
            } else {
                conditions.is_admin = true;
                conditions.is_media_node_admin = true;
            }
            userDBO.findOne(conditions, {
                bc_account_address: 1,
                social_accounts: 1,
            }, {}, false, (error, result) => {
                if (error) {
                    logger.error(error.message);
                    next({
                        error: userError.findUserFailed,
                        message: 'Error occurred while finding the user.',
                    });
                } else if (result) {
                    if (result.social_accounts && result.social_accounts.of_studio && result.social_accounts.of_studio.length) {
                        next(null, result, mediaSpace);
                    } else {
                        next({
                            error: userError.userDoesNotExist,
                            message: 'User has not authorized OF Studio.',
                        });
                    }
                } else {
                    next({
                        error: userError.userDoesNotExist,
                        message: 'User does not exist.',
                    });
                }
            });
        }, (user, mediaSpace, next) => {
            assetDBO.count({
                media_space: mediaSpace._id,
                is_default_asset: false,
                $or: [
                    {
                        'file.download.status': 'COMPLETE',
                    },
                    {
                        'file.encode.status': 'COMPLETE',
                    },
                ],
            }, (error, result) => {
                if (error) {
                    next({
                        error: assetError.findAssetFailed,
                        message: 'Error occurred while finding the assets.',
                    });
                } else if (result) {
                    next(null, user, result);
                } else {
                    next(null, user, 0);
                }
            });
        }, (user, assetCount, next) => {
            const userAuthToken = user.social_accounts.of_studio[0].access_token;
            const url = `${omniflixStudio.apiAddress}/media-node/assets-count`;
            const data = {
                token: userAuthToken,
                mediaNodeId: mediaSpaceConfig.id,
                assetCount: assetCount,
                bcAccountAddress: user.bc_account_address,
            };

            Axios({
                method: 'put',
                url,
                data,
            }).then((res) => {
                next(null, res.data);
            }).catch((error) => {
                if (error.response && error.response.data) {
                    logger.error(error.message, error.response.data);
                } else {
                    logger.error(error.message);
                }
                next(error);
            });
        },
    ], cb);
};

const updateAssetCountToStudioJob = () => {
    const job = new CronJob('* * * * *', () => {
        console.log('Updating asset count to Studio');
        updateAssetCountToStudio((error) => {
            if (error) {
                logger.error(error.message);
            }
        });
    });
    job.start();
};

updateAssetCountToStudioJob();

module.exports = {
    getAssets,
    getAssetTags,
    addAsset,
    getAsset,
    updateAsset,
    updateAssetFile,
    deleteAsset,
    encodeAsset,
    getAssetsOverview,
    addRunnerAssets,
    updateRunnerAsset,
    getAssetWatchURL,
    addScriptAsset,
    updateScriptAsset,
};
