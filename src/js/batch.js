module.exports = Em.ArrayProxy.extend({
    init: function() {
        this.set('content', []);
        this._super();
    },

    fileCount: Em.computed.alias('length'),

    pendingCount: function() {
        return this.reduce(function(result, item) {
            if (!item.get('isCompleted')) {
                result++;
            }
            return result;
        }, 0);
    }.property('@each.isCompleted'),

    completedCount: function() {
        //We use isProcessing, since it makes the progress bar look nicer
        return this.reduce(function(result, item) {
            if (item.get('isProcessing')) {
                result++;
            }
            return result;
        }, 0);
    }.property('@each.isProcessing'),

    progress: function() {
        var totalSize = 0,
            sent = 0;
        this.forEach(function(item) {
            var fileSize = item.get('file').size;
            totalSize += fileSize;
            sent += item.get('progress') * fileSize;
        }, 0);
        return sent / totalSize;
    }.property('@each.progress'),

    abort: function() {
        this.forEach(function(item) {
            item.abort();
        });
        while (this.get('length')) {
            this.removeAt(0);
        }
    }
});