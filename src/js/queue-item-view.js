var numeral = require('numeral');

module.exports = Em.View.extend({
    template: require('../templates/queue-item'),
    
    context: Em.computed.alias('content'),

    formattedFileSize: function() {
        return numeral(this.get('content.file.size')).format('0.0b');
    }.property('content.file.size'),

    actions: {
        abort: function() {
            this.get('content').abort();
        }
    }
});