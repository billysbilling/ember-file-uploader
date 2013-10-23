module.exports = Em.Object.createWithMixins({
    queue: null,

    init: function() {
        this._super();
        this.set('queue', Em.A());
    },

    enqueue: function(item) {
        var self = this;
        item.on('done', function(item) {
            self.get('queue').removeObject(item);
            self.pollQueue();
        });
        item.on('error', function() {
            self.pollQueue();
        });
        this.get('queue').pushObject(item);
        this.pollQueue();
    },

    pollQueue: function() {
        var concurrency = 5,
            transfers = 0;
        this.get('queue').forEach(function(item) {
            if (item.get('isFailed')) {
                return;
            }
            if (item.get('isTransferring')) {
                transfers++;
            } else {
                if (transfers < concurrency) {
                    transfers++;
                    item.upload();
                }
            }
        }, this);
    }
});