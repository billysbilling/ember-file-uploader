var i18n = require('i18n').module('ember_file_uploader', require.resolve('../locales')),
    QueueItem = require('./queue-item'),
    manager = require('./manager'),
    config = require('./config');

module.exports = Ember.Component.extend({
    template: require('../templates/file-uploader'),

    classNameBindings: [':file-uploader'],

    queue: null,
    multiple: true,

    url: '/files',

    allowDrag: true,
    dragTip: i18n.tProperty('dragTip', i18n.t('or_drag_and_drop')),
    dropTip: i18n.tProperty('dropTip', i18n.t('drop_files_here')),
    dropSelector: null,

    inputSelector: null,
    buttonText: i18n.tProperty('buttonText', function() {
        return this.get('multiple') ? i18n.t('select_files') : i18n.t('select_file');
    }).property('multiple'),
    buttonStyle: null,
    buttonSize: 'small',

    batch: null,

    thumbnailNames: '',

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
            input;
        if (selector) {
            parent = this.findBySelector(selector, 'input parent');
            parent.addClass('file-uploader-input-parent');
        } else {
            parent = this.$('.file-uploader-input-parent');
        }
        parent.append('<input type="file" class="file-uploader-input"' + (this.get('multiple') ? ' multiple' : '') + '/>');
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
    },

    getDropTarget: function() {
        var selector = this.get('dropSelector');
        if (selector) {
            return this.findBySelector(selector, 'drop target');
        } else {
            return this.$();
        }
    },
    getDropOverlay: function() {
        var overlay = this.get('dropOverlay');
        if (!overlay) {
            var dropTarget = this.getDropTarget();
            dropTarget.append(
                '<div class="file-uploader-overlay">'+
                '<div class="content">'+
                '<div class="drop-tip">'+this.get('dropTip')+'</div>'+
                '<div class="escape-tip">'+i18n.t('escape_tip')+'</div>'+
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
        body[method]('dragenter', Billy.proxy(this.onBodyDragEnter, this));
        body[method]('dragleave', Billy.proxy(this.onBodyDragLeave, this));
        body[method]('dragover', Billy.proxy(this.onBodyDragOver, this));
        body[method]('drop', Billy.proxy(this.onBodyDrop, this));
        dropTarget[method]('dragover', Billy.proxy(this.onDragOver, this));
        dropTarget[method]('dragleave', Billy.proxy(this.onDragLeave, this));
        dropTarget[method]('drop', Billy.proxy(this.onDrop, this));
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
        var dropTarget = this.getDropTarget(),
            overlay = this.getDropOverlay();
        dropTarget.addClass('has-overlay');
        overlay.css('display', 'block');
        overlay.height(dropTarget.outerHeight());
        overlay.width(dropTarget.outerWidth());
        overlay.position({
            my: 'top left',
            at: 'top left',
            of: dropTarget
        });
    },
    hideDropOverlay: function() {
        var dropTarget = this.getDropTarget(),
            overlay = this.getDropOverlay();
        dropTarget.removeClass('has-overlay');
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
        item.on('done', function(item) {
            if (self.get('isDestroyed')) {
                return;
            }
            self.get('queue').removeObject(item);
        });
        this.get('queue').pushObject(item);
        if (batch) {
            batch.pushObject(item);
        }
        manager.enqueue(item);
    },

    uploadButtonIsVisible: function() {
        return (!this.get('inputSelector') && (this.get('multiple') || this.get('queue.length') === 0));
    }.property('inputSelector', 'multiple', 'queue.@each'),

    queueItemViewClass: require('./queue-item-view')
});

module.exports.Batch = require('./batch');

module.exports.lang = i18n.lang;

module.exports.setHeader = function(key, value) {
    config.headers[key] = value;
};
module.exports.clearHeader = function(key) {
    delete(config.headers[key]);
};
module.exports.clearHeaders = function() {
    config.headers = {};
};
