class ApiResponse {
    constructor(results, message, pagination = null) {
        this.results = results;
        this.success = true;
        this.message = message;
        
        if (pagination) {
            this.count = pagination.count;
            this.next = pagination.next;
            this.previous = pagination.previous;

            // Copy totals if provided
            if (pagination.total_orders !== undefined) {
                this.total_orders = pagination.total_orders;
            }
            if (pagination.total_sales !== undefined) {
                this.total_sales = pagination.total_sales;
            }
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