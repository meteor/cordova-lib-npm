/**
    Licensed to the Apache Software Foundation (ASF) under one
    or more contributor license agreements.  See the NOTICE file
    distributed with this work for additional information
    regarding copyright ownership.  The ASF licenses this file
    to you under the Apache License, Version 2.0 (the
    "License"); you may not use this file except in compliance
    with the License.  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing,
    software distributed under the License is distributed on an
    "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
    KIND, either express or implied.  See the License for the
    specific language governing permissions and limitations
    under the License.
*/

/* jshint node:true, bitwise:true, undef:true, trailing:true, quotmark:true,
          indent:4, unused:vars, latedef:nofunc
*/

var xml_helpers = require('../../util/xml-helpers'),
    et = require('elementtree'),
    fs = require('fs'),
    path = require('path');

function csproj(location) {
    this.location = location;
    this.xml = xml_helpers.parseElementtreeSync(location);
    return this;
}

csproj.prototype = {
    write:function() {
        fs.writeFileSync(this.location, this.xml.write({indent:4}), 'utf-8');
    },

    addReference:function(relPath) {
        var item = new et.Element('ItemGroup');
        var extName = path.extname(relPath);

        var elem = new et.Element('Reference');
        // add dll file name
        elem.attrib.Include = path.basename(relPath, extName);
        // add hint path with full path
        var hint_path = new et.Element('HintPath');
        hint_path.text = relPath;
        elem.append(hint_path);

        if(extName == '.winmd') {
            var mdFileTag = new et.Element('IsWinMDFile');
            mdFileTag.text = 'true';
            elem.append(mdFileTag);
        }

        item.append(elem);

        this.xml.getroot().append(item);
    },

    removeReference:function(relPath) {
        var extName = path.extname(relPath);
        var includeText = path.basename(relPath,extName);
        // <ItemGroup>
        //   <Reference Include="WindowsRuntimeComponent1">
        var item_groups = this.xml.findall('ItemGroup/Reference[@Include="' + includeText + '"]/..');

        if(item_groups.length > 0 ) {
            this.xml.getroot().remove(0, item_groups[0]);
        }
    },

    addSourceFile:function(relative_path) {
        var compile;
        relative_path = relative_path.split('/').join('\\');
        // make ItemGroup to hold file.
        var item = new et.Element('ItemGroup');

        var extName = path.extname(relative_path);
        // check if it's a .xaml page
        if(extName == '.xaml') {
            var page = new et.Element('Page');
            var sub_type = new et.Element('SubType');

            sub_type.text = 'Designer';
            page.append(sub_type);
            page.attrib.Include = relative_path;

            var gen = new et.Element('Generator');
            gen.text = 'MSBuild:Compile';
            page.append(gen);

            var item_groups = this.xml.findall('ItemGroup');
            if(item_groups.length === 0) {
                item.append(page);
            } else {
                item_groups[0].append(page);
            }
        }
        else if (extName == '.cs') {
            compile = new et.Element('Compile');
            compile.attrib.Include = relative_path;
            // check if it's a .xaml.cs page that would depend on a .xaml of the same name
            if (relative_path.indexOf('.xaml.cs', relative_path.length - 8) > -1) {
                var dep = new et.Element('DependentUpon');
                var parts = relative_path.split('\\');
                var xaml_file = parts[parts.length - 1].substr(0, parts[parts.length - 1].length - 3); // Benn, really !?
                dep.text = xaml_file;
                compile.append(dep);
            }
            item.append(compile);
        }
        else { // otherwise add it normally
            compile = new et.Element('Content');
            compile.attrib.Include = relative_path;
            item.append(compile);
        }
        this.xml.getroot().append(item);
    },

    removeSourceFile:function(relative_path) {
        var isRegexp = relative_path instanceof RegExp;

        if (!isRegexp) {
            // path.normalize(relative_path);// ??
            relative_path = relative_path.split('/').join('\\');
        }

        var root = this.xml.getroot();
        // iterate through all ItemGroup/Content elements and remove all items matched
        this.xml.findall('ItemGroup').forEach(function(group){
            // matched files in current ItemGroup
            var filesToRemove = group.findall('Compile').concat(group.findall('Page'))
                .concat(group.findall('Content')).filter(function(item) {
                    if (!item.attrib.Include) return false;
                    return isRegexp ? item.attrib.Include.match(relative_path) :
                        item.attrib.Include == relative_path;
                });

            // nothing to remove, skip..
            if (filesToRemove.length < 1) return;

            filesToRemove.forEach(function(file){
                // remove file reference
                group.remove(0, file);
            });

            // remove ItemGroup if empty
            if(group.findall('*').length < 1) {
                root.remove(0, group);
            }
        });
    }
};

module.exports = csproj;
