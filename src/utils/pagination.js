class Pagination {
    static generatePaginationResponse(results, totalCount, page, limit, baseUrl, queryParams = {}) {
        const totalPages = Math.ceil(totalCount / limit);
        
        const pagination = {
            count: totalCount,
            next: null,
            previous: null
        };

        // Remove existing page and limit from query params
        const { page: _, limit: __, ...filteredParams } = queryParams;

        if (page < totalPages) {
            const nextParams = new URLSearchParams({
                ...filteredParams,
                page: (page + 1).toString(),
                limit: limit.toString()
            });
            pagination.next = `${baseUrl}?${nextParams.toString()}`;
        }

        if (page > 1) {
            const prevParams = new URLSearchParams({
                ...filteredParams,
                page: (page - 1).toString(),
                limit: limit.toString()
            });
            pagination.previous = `${baseUrl}?${prevParams.toString()}`;
        }

        return pagination;
    }
    
    static getPaginationParams(req) {
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(parseInt(req.query.limit) || 10, 10); // Max 100 per page
        const skip = (page - 1) * limit;
        
        return { page, limit, skip };
    }
}

module.exports = Pagination;