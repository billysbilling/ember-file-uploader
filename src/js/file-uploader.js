var functionProxy = require('function-proxy'),
    highestZIndex = require('highest-z-index'),
    i18nContext = require('i18n-context')('ember_file_uploader', require.resolve('../locales')),
    t = i18nContext.t,
    tProperty = i18nContext.tProperty,
    QueueItem = require('./queue-item'),
    manager = require('./manager'),
    config = require('./config'),
    svg = require('ember-svg').get;

module.exports = Ember.Component.extend({
    layout: require('../templates/file-uploader'),

    classNameBindings: [':file-uploader'],

    queue: null,
    multiple: true,

    isUploading: false,

    method: 'POST',

    url: '/files',

    headers: null,

    allowDrag: true,
    dragTip: tProperty('dragTip', t('or_drag_and_drop')),
    dropTip: tProperty('dropTip', t('drop_files_here')),
    dropSelector: null,
    dropOverlaySelector: null,
    dropAreaSize: 'large',

    inputSelector: null,

    accept: null,

    buttonIcon: null,
    buttonText: tProperty('buttonText', function() {
        return this.get('multiple') ? t('select_files') : t('select_file');
    }).property('multiple'),
    buttonStyle: null,
    buttonSize: 'small',

    batch: null,

    thumbnailNames: '',

    abortOnError: false,

    setupQueue: function() {
        this.set('queue', []);
    }.on('init'),

    didInsertElement: function() {
        this.setupFileInput();
        if (this.get('allowDrag')) {
            this.setupDropTarget();
        }
    },

    stopEvent: function(e) {
        e.stopPropagation();
        e.preventDefault();
    },
    findBySelector: function(selector, what) {
        var el = this.$().closest(selector);
        if (el.length) {
            return el;
        }
        el = $(selector);
        if (el.length) {
            return el;
        }
        throw new Error('No file-uploader '+what+' was found by the selector '+selector);
    },

    setupFileInput: function() {
        var self = this,
            selector = this.get('inputSelector'),
            parent,
            input,
            accept = Em.Handlebars.Utils.escapeExpression(this.get('accept'));
        if (selector) {
            parent = this.findBySelector(selector, 'input parent');
            parent.addClass('file-uploader-input-parent');
        } else {
            parent = this.$('.file-uploader-input-parent');
        }
        parent.append('<input type="file" class="file-uploader-input" accept="'+accept+'"' + (this.get('multiple') ? ' multiple' : '') + '/>');
        input = parent.find('> .file-uploader-input');
        if (selector) {
            this.set('externalInput', input);
        }
        input.change(function(e) {
            Em.run(function() {
                self.enqueue(input[0].files);
                input[0].value = null;
            });
        });
        //Add .hover class to the upload button, since it's masked by the invisible file input field
        parent.mouseenter(function() {
            parent.find('.button').addClass('hover');
        });
        parent.mouseleave(function() {
            parent.find('.button').removeClass('hover');
        });
        //Add .focus class to the upload button, when the input is focused for the same reason
        input.focus(function() {
            parent.find('.button').addClass('focus');
        });
        input.blur(function() {
            parent.find('.button').removeClass('focus');
        });
    },

    getDropTarget: function() {
        var selector = this.get('dropSelector');
        if (selector) {
            return this.findBySelector(selector, 'drop target');
        } else {
            return this.$();
        }
    },
    getDropOverlayTarget: function() {
        var selector = this.get('dropOverlaySelector');
        if (!selector) {
            selector = this.get('dropSelector');
        }
        if (selector) {
            return this.findBySelector(selector, 'drop overlay target');
        } else {
            return this.$();
        }
    },
    getDropOverlay: function() {
        var overlay = this.get('dropOverlay');
        if (!overlay) {
            var dropTarget = this.getDropOverlayTarget(),
                dropAreaSize = this.get('dropAreaSize'),
                iconSize = ['small', 'large'].indexOf(dropAreaSize) === -1 ? 'small' : dropAreaSize;
            dropTarget.append(
                '<div class="file-uploader-overlay '+dropAreaSize+'">'+
                '<div class="content">'+
                '<div class="drop-tip"><div class="icon">'+svg('icons/arrow-down-'+iconSize)+'</div><div class="text">'+this.get('dropTip')+'</div></div>'+
                '<div class="escape-tip">'+t('escape_tip')+'</div>'+
                '</div>'+
                '</div>'
            );
            overlay = dropTarget.find(' > .file-uploader-overlay');
            this.set('dropOverlay', overlay);
        }
        return overlay;
    },

    setupDropTarget: function() {
        this.addOrRemoveDropTargetEvents('on');
    },

    addOrRemoveDropTargetEvents: function(method) {
        var dropTarget = this.getDropTarget(),
            body = $(this.container.lookup('application:main').get('rootElement'));
        body[method]('dragenter', functionProxy(this.onBodyDragEnter, this));
        body[method]('dragleave', functionProxy(this.onBodyDragLeave, this));
        body[method]('dragover', functionProxy(this.onBodyDragOver, this));
        body[method]('drop', functionProxy(this.onBodyDrop, this));
        dropTarget[method]('dragover', functionProxy(this.onDragOver, this));
        dropTarget[method]('dragleave', functionProxy(this.onDragLeave, this));
        dropTarget[method]('drop', functionProxy(this.onDrop, this));
    },

    onBodyDragEnter: function(e) {
        this.ignoreNextBodyDragLeave = true;
        this.showDropOverlay();
        return false;
    },
    onBodyDragLeave: function(e) {
        if (this.ignoreNextBodyDragLeave) {
            this.ignoreNextBodyDragLeave = false;
        } else {
            this.hideDropOverlay();
        }
    },
    onBodyDragOver: function(e) {
        this.stopEvent(e);
        return false;
    },
    onBodyDrop: function(e) {
        this.hideDropOverlay();
        this.stopEvent(e);
    },
    onDragOver: function(e) {
        this.getDropOverlay().addClass('hover');
    },
    onDragLeave: function(e) {
        this.getDropOverlay().removeClass('hover');
    },
    onDrop: function(e) {
        var self = this;
        Em.run(function() {
            var files = e.dataTransfer.files;
            self.enqueue(files);
        });
    },
    showDropOverlay: function() {
        var dropTarget = this.getDropOverlayTarget(),
            overlay = this.getDropOverlay();
        overlay.css('display', 'block');
        overlay.css('z-index', 1 + highestZIndex(overlay.siblings()));
        overlay.height(dropTarget.outerHeight());
        overlay.width(dropTarget.outerWidth());
        overlay.position({
            my: 'top left',
            at: 'top left',
            of: dropTarget
        });
    },
    hideDropOverlay: function() {
        var dropTarget = this.getDropOverlayTarget(),
            overlay = this.getDropOverlay();
        overlay.css('display', 'none');
    },

    willDestroyElement: function() {
        var overlay = this.get('dropOverlay'),
            externalInput = this.get('externalInput');
        //Overlay
        if (overlay) {
            overlay.remove();
        }
        //External input
        if (externalInput) {
            externalInput.parent().removeClass('file-uploader-input-parent');
            externalInput.remove();
        }
        //Drop target
        if (this.get('allowDrag')) {
            this.addOrRemoveDropTargetEvents('off');
        }
    },

    enqueue: function(file) {
        var self = this,
            item,
            batch = this.get('batch');
        if (Em.isArray(file)) {
            Array.prototype.forEach.call(file, function(f) {
                this.enqueue(f);
            }, this);
            return;
        }
        if (!this.get('multiple') && this.get('queue.length') > 0) {
            return;
        }
        this.set('isUploading', true);
        item = QueueItem.create({
            fileUploader: this,
            file: file
        });
        item.on('upload', function(file, payload) {
            BD.store.sideload(payload);
            self.sendAction('didUploadFile', {
                file: file,
                payload: payload
            });
        });
        item.on('error', function(payload) {
            self.sendAction('uploadFailed', {
                payload: payload
            });
        });
        item.on('done', function(item) {
            if (self.get('isDestroyed')) {
                return;
            }
            self.removeQueueItem(item);
        });
        this.get('queue').pushObject(item);
        if (batch) {
            batch.pushObject(item);
        }
        manager.enqueue(item);
    },

    removeQueueItem: function(item) {
        this.get('queue').removeObject(item);
        if (this.get('queue.length') === 0) {
            this.set('isUploading', false);
        }
    },

    uploadButtonIsVisible: function() {
        return (!this.get('inputSelector') && (this.get('multiple') || this.get('queue.length') === 0));
    }.property('inputSelector', 'multiple', 'queue.@each'),

    queueItemViewClass: require('./queue-item-view')
});

module.exports.Batch = require('./batch');

module.exports.locale = i18nContext.locale;

module.exports.lang = function() {
    console.warn('.lang() is deprecated. Use .locale() instead');
    return i18nContext.locale.apply(null, arguments);
};

module.exports.setHeader = function(key, value) {
    config.headers[key] = value;
};
module.exports.clearHeader = function(key) {
    delete(config.headers[key]);
};
module.exports.clearHeaders = function() {
    config.headers = {};
};
