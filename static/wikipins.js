if (!window.console) {
    window.console = { log:   function() { },
                       error: function() { }
                     };
}

_.mixin({
    zipToObject: function(keys) {
        var arrays = Array.prototype.slice.call(arguments, 1);
        var ret = [ ];
        if (arrays.length < 1) {
            return [ ];
        }
        var i, j;
        for (i = 0; i < arrays[0].length; ++i) {
            var o = { };
            for (j = 0; j < keys.length; ++j) {
                o[keys[j]] = arrays[j][i];
            }
            ret.push(o);
        }
        return ret;
    }
});

function get_image_url(file_name, width, ns) {
    ns = ns || 'commons';
    file_name = file_name.replace(/\ /g, "_");
    var md5sum = hex_md5(file_name);
    var img_url = '';
    if (width == 0) {
        img_url = "//upload.wikimedia.org/wikipedia/" + ns +
            "/" + md5sum[0] + "/" + md5sum.substr(0, 2) + "/" + file_name;
    } else {
        var thumb_name = width + "px-" + file_name;
        if (file_name.search(/\.svg$/i) != -1) {
            thumb_name += ".png";
        }
        img_url = "//upload.wikimedia.org/wikipedia/" + ns +
            "/thumb/" + md5sum[0] + "/" +
            md5sum.substr(0, 2) + "/" +
            file_name + "/" + thumb_name;
    }
    return img_url;
}

function on_image_error_01() {
    var img = $(this);
    console.log("[1] Error loading:", img.data('img-name'));
    img.off('error')
        .on('error', on_image_error_02);
    img.attr('src', get_image_url(img.data('img-name'),
                                  0, 'commons'));
    if (img.data('img-width') == 240) {
        // Set max-height to 240px.
        // img.parent().css('max-height', "240px");
    }
}

function on_image_error_02() {
    var img = $(this);
    console.log("[2] Error loading:", img.data('img-name'));
    img.off('error')
        .on('error', on_image_error_03);
    img.attr('src', get_image_url(img.data('img-name'),
                                  img.data('img-width'),
                                  'en'
                                 ));
}

function on_image_error_03() {
    var img = $(this);
    console.log("[3] Error loading:", img.data('img-name'));
    img.off('error');
    img.attr('src', get_image_url(img.data('img-name'),
                                  0, 'en'));
}

function item_cmp(lhs, rhs) {
    var cmp1 = rhs.images.length - lhs.images.length;
    return (cmp1 === 0 ? lhs.index - rhs.index : cmp1);
}

function filter_empty_item(item) {
    return item.images.length > 0;
}

function get_category_pin_div(item) {
    var div = $("#category-pin-template").clone()
        .attr("id", null)
        .addClass("pin")
        .addClass("category-pin");
    div.find("a.pin-click").attr('href', '/c/' + escape(item.category.replace(/\ /g, '_')));
    div.find('.category-name').html(item.category);
    var images = item.images.slice(0,4);
    if (images.length === 2) {
        images = images.slice(0, 1);
    }
    var sm_width = Math.floor(240 / (images.length - 1));
    var imgs = images.map(function(img_info, idx) {
        var img_width = idx > 0 ? sm_width : 240;
        var img_url = get_image_url(img_info.image, img_width);
        var img  = $("<img />")
            .attr('src', '/static/grey.gif')
            .attr('data-src', img_url)
            .attr('width', img_width + "px")
            .attr('title', img_info.title)
            .attr('alt', img_info.title)
            .addClass('pin-image')
            .on('error', on_image_error_01);
        if (idx > 0) {
            img.css('height', img_width + "px");
        }
        img.data('img-name', img_info.image);
        img.data('img-width', img_width);
        return img;
    });
    var bigger =  $("<div></div>").addClass("bigger");
    var smaller = $("<div></div>").addClass("smaller");
    bigger.append(imgs[0]);
    imgs.slice(1).forEach(function(img) {
        img.css('float', 'left');
        smaller.append(img);
    });
    div.find(".image").append(bigger);
    if (imgs.length > 1) {
        smaller.append($("<div></div>").addClass("clear-both"));
        div.find(".image").append(smaller);
    }
    return div;
}

function get_article_pin_div(item) {
    var div = $("#article-pin-template").clone()
        .attr("id", null)
        .addClass("pin")
        .addClass("article-pin");
    div.find('a.pin-click').attr('href', "/a/" + item.title.replace(/\ /, '_'));
    div.find('.title').html(item.title);
    div.find('.abstract').html(item['abstract']);

    var img_name = item.image.trim();
    if (!img_name) {
        div.find(".image").remove();
    } else {
        var img_url  = get_image_url(img_name, 240);
        var bigger   =  $("<div></div>").addClass("bigger");
        var img      = $("<img />")
            .attr('src', '/static/grey.gif')
            .attr('data-src', img_url)
            .attr('width', "240px")
            .addClass('pin-image')
            .on('error', on_image_error_01);

        img.data('img-name', img_name);
        img.data('img-width', 240);

        bigger.append(img);
        div.find(".image").append(bigger);
    }

    return div;
}

function get_article_broad_pin_div(item) {
    var div = $("#article-broad-pin-template").clone()
        .attr("id", null);
    div.find('a.pin-click').attr('href', "//en.wikipedia.org/wiki/" + item.title.replace(/\ /, '_'));
    div.find('.title').html(item.title);
    div.find('.broad-abstract').html(item['abstract']);

    var img_name = item.image.trim();
    if (!img_name) {
        div.find(".image").remove();
    } else {
        var img_url  = get_image_url(img_name, 240);
        var bigger   =  $("<div></div>").addClass("bigger");
        var img      = $("<img />")
            .attr('src', img_url)
            .attr('width', "240px")
            .addClass('pin-image')
            .on('error', on_image_error_01);

        img.data('img-name', img_name);
        img.data('img-width', 240);

        bigger.append(img);
        div.find(".image").append(bigger);
    }

    return div;
}

function num_cmp(lhs, rhs) {
    return lhs - rhs;
}

function add_vspacer() {
    console.log("timedout");
    var all_bottoms = $("#content .pin").map(function() {
        var t = $(this);
        return t.position().top + t.height();
    }).sort(num_cmp);
    if (all_bottoms.length == 0) {
        return;
    }
    var max_bottom = all_bottoms[all_bottoms.length - 1];
    var vspacer = $("<div>&nbsp;</div>").
        addClass('vspacer').
        css('top', max_bottom + "px");
    $("#content").append(vspacer);
}

function populate_article_pins_on_page(a, parent) {
    a.forEach(function(item) {
        var div  = get_article_pin_div(item);
        parent.append(div);
    });
    parent.find(".pin").pinlike({
        colwidth: 290
    });
    parent.find(".pin img.pin-image").unveil(150);
    // Trigger the 'scroll' event so that the
    // unveil-plugin can start showing images. This is
    // an issue since the unveil-plugin start working
    // only when the scroll OR resize event on the
    // window is fired.
    setTimeout(function() {
        $(window).trigger('scroll');
    }, 20);

    $(".btn-goto-wikipedia-page").click(function(event) {
        var pin = $(this).closest(".pin");
        var title = pin.find(".title").text();
        var a = $(this).closest("a");
        var href = a.attr('href');
        a.attr('href', "//en.wikipedia.org/wiki/" + title.replace(/\ /g, '_'));
        setTimeout(function() {
            a.attr('href', href);
        }, 30);
        // return false;
    });
}

function populate_category_pins_on_page(data, parent) {
    console.log("populate_category_pins_on_page(", data, ")");
    var a = [ ];
    var key;
    for (key in data) {
        var item = data[key];
        if (item.length > 0) {
            a.push({
                category: key,
                count: item[0].count,
                images: _.zipToObject(['title', 'image'], _.pluck(item, 'title'), _.pluck(item, 'image')),
                index: a.length
            });
            console.log("a:", a);
        }
    }
    console.log("a", a);
    a = a.filter(filter_empty_item);
    a.sort(item_cmp);
    a.forEach(function(item) {
        var div  = get_category_pin_div(item);
        parent.append(div);
    });
    parent.find(".pin").pinlike({
        colwidth: 290
    });
    parent.find(".pin img.pin-image").unveil(150);
    setTimeout(function() {
        $(window).trigger('scroll');
    }, 20);
}

function load_related_category_pins(title, parent) {
    console.log("load_related_category_article_pins(", title, ")");
    $.ajax({
        url: "/related_categories/",
        dataType: 'jsonp',
        data: {
            title: title
        },
        success: function(a) {
            populate_category_pins_on_page(a, parent);
        }
    });
}

function load_single_article_pin(title, parent) {
    console.log("load_article_pins(", title, ")");
    $.ajax({
        url: "/article_abstract/",
        dataType: 'jsonp',
        data: {
            title: title
        },
        success: function(a) {
            if (a.length === 0) {
                return;
            }
            var div  = get_article_broad_pin_div(a[0]);
            parent.append(div);
        }
    });
}

function load_article_pins(category, parent) {
    console.log("load_article_pins(", category, ")");
    $.ajax({
        url: "/category_abstracts/",
        dataType: 'jsonp',
        data: {
            category: category
        },
        success: function(a) {
            // console.log("a:", a);
            populate_article_pins_on_page(a, parent);
        }
    });
}

function load_category_pins(url, parent) {
    $.ajax({
        url:  url,
        dataType: 'jsonp',
        success: function(data) {
            populate_category_pins_on_page(data, parent);
        }
    });
}

function get_wiki_entries_by_prefix(term, cb) {
    $.ajax({
        url: "//autocomplete.wikipins.org/suggest/",
        dataType: 'jsonp',
        data: { q: term.term, n: 10 },
        success: function(data) {
            console.log(data);
            data.articles = _.uniq(data.articles, false, function(a) {
                return a.phrase;
            });
            data.categories = _.uniq(data.categories, false, function(a) {
                return a.phrase;
            });
            var opts = [ ];
            data.categories.forEach(function(e) {
                opts.push({ label: e.phrase + " (category)", value: e.phrase });
            });
            data.articles.forEach(function(e) {
                opts.push({ label: e.phrase + " (article)", value: e.phrase });
            });
            cb(opts);
        },
        error: function() {
            cb([]);
        }
    });
}

function reflow_pins() {
    var ww = $(window).width();
    $("#content-wrapper").width(ww - 20);
    var cw = Math.floor(ww / 290) * 291;
    // console.log("reflowing pins with cw =", cw);

    $("#content").width(cw);
    $("#content .pin").pinlike();

    $("#content2").width(cw);
    $("#content2 .pin").pinlike();
}

function goto_search_location(term) {
}

function set_search_box_handlers() {
    var search_box = $("#search-box");
    search_box.data('state', 'initial');
    search_box.addClass('search-box-initial');
    search_box.focus(function(event) {
        if (search_box.data('state') == 'initial') {
            search_box.val('');
            search_box.removeClass('search-box-initial');
            search_box.data('state', 'typing');
        }
    });
    search_box.blur(function(event) {
        if (jQuery.trim(search_box.val()).length == 0) {
            search_box.addClass('search-box-initial');
            search_box.data('state', 'initial');
            search_box.val('Search');
        }
    });

    /*
      search_box.change(function(event) {
      console.log("foo");
      if (jQuery.trim(search_box.val()).length == 0) {
      search_box.addClass('search-box-initial');
      search_box.data('state', 'initial');
      search_box.val('Search');
      } else {
      search_box.removeClass('search-box-initial');
      search_box.data('state', 'typing');
      }
      });
    */

    search_box.keyup(function(event) {
        if (event.keyCode == 13) {
            // alert("Sorry, not implemented");
        }
    });
}

function set_pin_handlers() {
    $(".pin").live('mouseenter', function() {
        var self = $(this);
        var pin_actions = self.find(".pin-actions");
        pin_actions.css('display', 'block');
        var x = self.position().left;
        var y = self.position().top;
        pin_actions.css('top', (y - 50) + "px");
        pin_actions.css('left', (x + 190) + "px");

    }).live('mouseleave', function() {
        var self = $(this);
        var pin_actions = self.find(".pin-actions");
        pin_actions.css('display', 'none');
    });
}

function set_menu_handlers() {
    $("#about").click(function() {
        $("#about-content").dialog({
            title: "About Wikipins",
            maxWidth: 600,
            width: 400
        });
    });

    $("#contact").click(function() {
        $("#contact-content").dialog({
            title: "Contact",
            maxWidth: 600,
            width: 400
        });
    });
}

$().ready(function() {
    $(window).resize(reflow_pins);
    reflow_pins();

    set_pin_handlers();
    set_menu_handlers();
    set_search_box_handlers();

    $(window).keyup(function(event) {
        console.log(event);
        if (event.keyCode === 191) {
            $("#search-box").trigger('focus');
        }
    });

    $("#search-button").click(function(event) {
        alert("Sorry, not implemented");
    });

    var pathname = window.location.pathname;
    var m1 = pathname.match(/^\/c\/([^\/]+)\/?$/);
    var m2 = pathname.match(/^\/a\/([^\/]+)\/?$/);
    if (m1) {
        var category = unescape(m1[1]).replace(/_/g, ' ');
        // console.log("category:", category);
        $('#page-title').html('')
            .append($("<a>Wikipins</a>").attr('href', '/'))
            .append(" - " + category);
        load_article_pins(category, $("#content"));

    } else if (m2) {
        var title = unescape(m2[1]).replace(/_/g, ' ');
        // console.log("title:", title);
        $('#page-title').html('')
            .append($("<a>Wikipins</a>").attr('href', '/'))
            .append(" - " + title);
        load_single_article_pin(title, $("#content"));
        load_related_category_pins(title, $("#content2"));
        $("#content2").css('display', 'block');
    } else {
        load_category_pins("/random_categories/", $("#content"));
    }

    var htext_width = $("#page-title").width();
    console.log("htext_width:", htext_width);

    $("#htext").css('width', (htext_width + 5) + "px");

    $("#search-box").autocomplete({
        source: get_wiki_entries_by_prefix,
        select: function(event, ui) {
            var item = ui.item;
            if (item.label.search(/\(category\)$/) != -1) {
                window.location = "/c/" + escape(item.value.replace(/\ /g, '_'));
            } else {
                window.location = "/a/" + escape(item.value.replace(/\ /g, '_'));
            }
        }
    });
});
