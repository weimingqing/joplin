import { RuleOptions } from '../../MdToHtml';

const Entities = require('html-entities').AllHtmlEntities;
const htmlentities = new Entities().encode;
const utils = require('../../utils');
const urlUtils = require('../../urlUtils.js');
const { getClassNameForMimeType } = require('font-awesome-filetypes');

function plugin(markdownIt:any, ruleOptions:RuleOptions) {
	markdownIt.renderer.rules.link_open = function(tokens:any[], idx:number) {
		const token = tokens[idx];
		let href = utils.getAttr(token.attrs, 'href');
		const resourceHrefInfo = urlUtils.parseResourceUrl(href);
		const isResourceUrl = ruleOptions.resources && !!resourceHrefInfo;
		let title = utils.getAttr(token.attrs, 'title', isResourceUrl ? '' : href);

		let resourceIdAttr = '';
		let icon = '';
		let hrefAttr = '#';
		let mime = '';
		let resourceId = '';
		if (isResourceUrl) {
			resourceId = resourceHrefInfo.itemId;

			const result = ruleOptions.resources[resourceId];
			const resourceStatus = utils.resourceStatus(ruleOptions.ResourceModel, result);

			if (result && result.item) {
				title = utils.getAttr(token.attrs, 'title', result.item.title);
				mime = result.item.mime;
			}

			if (result && resourceStatus !== 'ready' && !ruleOptions.plainResourceRendering) {
				const icon = utils.resourceStatusFile(resourceStatus);
				return `<a class="not-loaded-resource resource-status-${resourceStatus}" data-resource-id="${resourceId}">` + `<img src="data:image/svg+xml;utf8,${htmlentities(icon)}"/>`;
			} else {
				href = `joplin://${resourceId}`;
				if (resourceHrefInfo.hash) href += `#${resourceHrefInfo.hash}`;
				resourceIdAttr = `data-resource-id='${resourceId}'`;

				let iconType = getClassNameForMimeType(mime);
				if (!mime) {
					iconType = 'fa-joplin';
				}
				// Icons are defined in lib/renderers/noteStyle using inline svg
				// The icons are taken from fork-awesome but use the font-awesome naming scheme in order
				// to be more compatible with the getClass library
				icon = `<span class="resource-icon ${iconType}"></span>`;
			}
		} else {
			// If the link is a plain URL (as opposed to a resource link), set the href to the actual
			// link. This allows the link to be exported too when exporting to PDF.
			hrefAttr = href;
		}

		// A single quote is valid in a URL but we don't want any because the
		// href is already enclosed in single quotes.
		// https://github.com/laurent22/joplin/issues/2030
		href = href.replace(/'/g, '%27');

		let js = `${ruleOptions.postMessageSyntax}(${JSON.stringify(href)}, { resourceId: ${JSON.stringify(resourceId)} }); return false;`;
		if (ruleOptions.enableLongPress && !!resourceId) {
			const onClick = `${ruleOptions.postMessageSyntax}(${JSON.stringify(href)})`;
			const onLongClick = `${ruleOptions.postMessageSyntax}("longclick:${resourceId}")`;
			const touchStart = `t=setTimeout(()=>{t=null; ${onLongClick};}, ${ruleOptions.longPressDelay});`;
			const cancel = 'if (!!t) {clearTimeout(t); t=null;';
			const touchEnd = `${cancel} ${onClick};}`;
			js = `ontouchstart='${touchStart}' ontouchend='${touchEnd}' ontouchcancel='${cancel} ontouchmove="${cancel}'`;
		} else {
			js = `onclick='${js}'`;
		}

		if (hrefAttr.indexOf('#') === 0 && href.indexOf('#') === 0) js = ''; // If it's an internal anchor, don't add any JS since the webview is going to handle navigating to the right place

		const attrHtml = [];
		attrHtml.push('data-from-md');
		if (resourceIdAttr) attrHtml.push(resourceIdAttr);
		if (title) attrHtml.push(`title='${htmlentities(title)}'`);
		if (mime) attrHtml.push(`type='${htmlentities(mime)}'`);

		if (ruleOptions.plainResourceRendering || ruleOptions.linkRenderingType === 2) {
			icon = '';
			attrHtml.push(`href='${htmlentities(href)}'`);

			// return `<a data-from-md ${resourceIdAttr} title='${htmlentities(title)}' href='${htmlentities(href)}' type='${htmlentities(mime)}'>`;
		} else {
			attrHtml.push(`href='${hrefAttr}'`);
			if (js) attrHtml.push(js);
			// return `<a data-from-md ${resourceIdAttr} title='${htmlentities(title)}' href='${hrefAttr}' ${js} type='${htmlentities(mime)}'>${icon}`;
		}

		return `<a ${attrHtml.join(' ')}>${icon}`;
	};
}

export default { plugin };
