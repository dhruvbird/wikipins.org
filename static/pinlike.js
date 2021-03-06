$.fn.pinlike = function(opts) {
    var elems = this;
    var outer = $(this).first().parent();
    if (outer.length == 0) {
        return this;
    }

    if (outer.hasClass('pin-column')) {
        outer = outer.parent();
        elems.detach();
        outer.find(".pin-column").remove();
        outer.append(elems);
    }

    opts = opts || outer.data('opts');
    if (!opts) {
        return this;
    }
    outer.data('opts', opts);

    if (!elems.length) {
        return this;
    }

    var colwidth = opts.colwidth || elems.first().width();
    var outwidth = outer.width();
    var ncols    = Math.floor(outwidth / colwidth);

    if (ncols == 0) {
        return this;
    }

    setTimeout(function() {
        var colheights = new Array(ncols);
        var cols       = new Array(ncols);
        var i;
        for (i = 0; i < ncols; ++i) {
            colheights[i] = 0;
            cols[i] = $("<div></div>")
                .addClass('pin-column')
                .css('width', colwidth + "px")
                .css('float', 'left');
        }

        elems.each(function(index, elem) {
            var mincol = 0;
            for (i = 0; i < ncols; ++i) {
                if (colheights[i] < colheights[mincol]) {
                    mincol = i;
                }
            }
            colheights[mincol] += $(elem).height();
            console.log("height", $(elem).height());
            cols[mincol].append(elem);
            console.log("column heights:", String(colheights));
        });

        outer.append(cols);
        outer.append($("<div></div>").css('clear', 'both'));
    }, 20);

    return this;
};
