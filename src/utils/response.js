class ApiResponse {
    constructor(results, message, pagination = null) {
        this.results = results;
        this.success = true;
        this.message = message;
        
        if (pagination) {
            this.count = pagination.count;
            this.next = pagination.next;
            this.previous = pagination.previous;
            this.total_page = pagination.total_page;
        }
    }
}

class ErrorResponse {
    constructor(message) {
        this.success = false;
        this.message = message;
    }
}

module.exports = {
    ApiResponse,
    ErrorResponse
};