const getAssetCategoryPipeLine = (user, encode, mediaSpace) => {
    const pipeline = [{
        $match: {
            user: user,
            media_space: mediaSpace,
        },
    }, {
        $lookup: {
            from: 'assets',
            localField: '_id',
            foreignField: 'category',
            as: 'assets',
        },
    }];
    if (encode === 'true') {
        pipeline.push({
            $project: {
                _id: 1,
                name: 1,
                assets: {
                    $filter: {
                        input: '$assets',
                        as: 'asset',
                        cond: {
                            $and: [{
                                $eq: ['$$asset.file.encode.status', 'COMPLETE'],
                            }, {
                                $eq: ['$$asset.type', 'video'],
                            }],
                        },
                    },
                },
            },
        });
    }
    pipeline.push({
        $project: {
            _id: 1,
            name: 1,
            count: {
                $cond: {
                    if: { $isArray: '$assets' },
                    then: { $size: '$assets' },
                    else: 0,
                },
            },
        },
    });
    return pipeline;
};

module.exports = {
    getAssetCategoryPipeLine,
};
