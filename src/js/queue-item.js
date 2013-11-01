var i18n = require('i18n').module('ember_file_uploader', require.resolve('../locales'));

module.exports = Em.Object.extend(Em.Evented, {
    fileUploader: null,
    file: null,

    isTransferring: false,
    isProcessing: false,
    isCompleted: false,
    isFailed: false,
    progress: 0,
    status: '',

    uploadRequest: null,

    upload: function() {
        var file = this.get('file'),
            url = BD.url(this.get('fileUploader.url')),
            uploadRequest = new FileUploadRequest('POST', url, file);
        this.set('isTransferring', true);
        this.set('uploadRequest', uploadRequest);
        uploadRequest.on('readystatechange', Billy.proxy(this.onReadyStateChange, this));
        uploadRequest.on('progress', Billy.proxy(this.onUploadProgress, this));
        uploadRequest.on('load', Billy.proxy(this.onUploadLoad, this));
        uploadRequest.on('error', Billy.proxy(this.onUploadError, this));
        uploadRequest.setRequestHeader('X-Filename', file.name);
        uploadRequest.setRequestHeader('X-File-Size', file.size);
        uploadRequest.setRequestHeader('X-Thumbnail-Names', this.get('fileUploader.thumbnailNames'));
        uploadRequest.send();
    },
    onReadyStateChange: function() {
        var self = this;
        Em.run(function() {
            var uploadRequest = self.get('uploadRequest'),
                payload,
                file;
            if (uploadRequest.readyState == 4) {
                try {
                    payload = $.parseJSON(uploadRequest.responseText);
                } catch(exception) {
                    //Do nothing, transfer will fail anyway
                }
                if (!payload) {
                    self.handleError();
                } else if (uploadRequest.status == 200) {
                    if (payload.files && payload.files.length) {
                        file = BD.store.load(Billy.File, payload.files[0]);
                    }
                    self.set('isCompleted', true);
                    self.trigger('upload', file, payload);
                    self.trigger('done', self);
                } else if (uploadRequest.status == 422) {
                    self.handleError(payload.errorMessage);
                } else {
                    self.handleError();
                }
            }
        });
    },
    onUploadProgress: function(e) {
        var self = this;
        Em.run(function() {
            if (e.lengthComputable) {
                self.set('progress', Math.ceil(e.loaded / e.total));
            }
        });
    },
    onUploadLoad: function() {
        var self = this;
        Em.run(function() {
            self.set('progress', 1);
            self.set('isProcessing', true);
        });
    },
    onUploadError: function() {
        var self = this;
        Em.run(function() {
            self.handleError();
        });
    },
    handleError: function(message) {
        this.set('isFailed', true);
        this.set('isTransferring', false);
        this.set('error', message || i18n.t('file_uploader.upload_failed'));
        this.trigger('error');
    },

    abort: function() {
        var uploadRequest = this.get('uploadRequest');
        if (uploadRequest) {
            uploadRequest.abort();
        }
        this.trigger('done', this);
    }
});