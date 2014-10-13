var functionProxy = require('function-proxy'),
    i18nContext = require('i18n-context')('ember_file_uploader', require.resolve('../locales')),
    t = i18nContext.t,
    config = require('./config');

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
            url = this.get('fileUploader.url'),
            uploadRequest = new FileUploadRequest('POST', url, file),
            additionalHeaders = config.headers,
            uploaderHeaders = this.get('fileUploader.headers');
        this.set('isTransferring', true);
        this.set('uploadRequest', uploadRequest);
        uploadRequest.on('readystatechange', functionProxy(this.onReadyStateChange, this));
        uploadRequest.on('progress', functionProxy(this.onUploadProgress, this));
        uploadRequest.on('load', functionProxy(this.onUploadLoad, this));
        uploadRequest.on('error', functionProxy(this.onUploadError, this));
        uploadRequest.setRequestHeader('X-Filename', file.name);
        uploadRequest.setRequestHeader('X-File-Size', file.size);
        uploadRequest.setRequestHeader('X-Thumbnail-Names', this.get('fileUploader.thumbnailNames'));
        for (var k in additionalHeaders) {
            if (additionalHeaders.hasOwnProperty(k)) {
                uploadRequest.setRequestHeader(k, additionalHeaders[k]);
            }
        }
        for (var k in uploaderHeaders) {
            if (uploaderHeaders.hasOwnProperty(k)) {
                uploadRequest.setRequestHeader(k, uploaderHeaders[k]);
            }
        }
        uploadRequest.send();
    },
    onReadyStateChange: function() {
        var self = this;
        Em.run(function() {
            var uploadRequest = self.get('uploadRequest'),
                payload,
                file;
            if (uploadRequest.readyState === 4) {
                try {
                    payload = $.parseJSON(uploadRequest.responseText);
                } catch(exception) {
                    //Do nothing, transfer will fail anyway
                }
                if (!payload) {
                    self.handleError();
                } else if (uploadRequest.status === 200) {
                    if (payload.files && payload.files.length) {
                        file = BD.store.load(Billy.File, payload.files[0]);
                    }
                    self.set('isProcessing', false);
                    self.set('isCompleted', true);
                    self.trigger('upload', file, payload);
                    self.trigger('done', self);
                } else if (uploadRequest.status === 422) {
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
                self.set('progress', Math.round((e.loaded / e.total) * 1000) / 1000);
            }
        });
    },
    onUploadLoad: function() {
        var self = this;
        Em.run(function() {
            self.set('progress', 1);
            self.set('isProcessing', true);
            self.set('isTransferring', false);
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
        this.set('error', message || t('upload_failed'));
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
