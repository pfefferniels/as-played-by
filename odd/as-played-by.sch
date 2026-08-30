<?xml version="1.0" encoding="UTF-8"?>
<schema xmlns="http://purl.oclc.org/dsdl/schematron" queryBinding="xslt2">
   <title>ISO Schematron rules</title>
   <!-- This file generated 2026-08-30T16:06:32Z by 'extract-isosch.xsl'. -->
   <!-- ********************* -->
   <!-- namespaces, declared: -->
   <!-- ********************* -->
   <ns prefix="mei" uri="http://www.music-encoding.org/ns/mei"/>
   <ns prefix="xlink" uri="http://www.w3.org/1999/xlink"/>
   <!-- ******************************************************** -->
   <!-- constraints in en, und, mul, zxx, of which there are 201 -->
   <!-- ******************************************************** -->
   <pattern id="schematron-constraint-warn_deprecated-1">
      <rule context="@artic">
         <assert role="warning"
                  test="not(contains(., 'marc-stacc')) and not(contains(., 'ten-stacc'))">"<value-of select="."/>" contains a deprecated value.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-warn_deprecated-2">
      <rule context="@artic.ges">
         <assert role="warning"
                  test="not(contains(., 'marc-stacc')) and not(contains(., 'ten-stacc'))">"<value-of select="."/>" contains a deprecated value.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-constrain_place-3">
      <rule context="@place">
         <assert test="not((some $token in tokenize(normalize-space(.),' ') satisfies             $token =('below','above','between','within')) and count(tokenize(normalize-space(.),' ')) gt 1)">Other values not permitted when 'above', 'below', 'between' or 'within' is present.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-between_requires_adjacent_staves-4">
      <rule context="mei:*[@place eq 'between']">
         <assert test="count(tokenize(normalize-space(string(@staff)), '\s+')) = 2">The @staff attribute must contain 2 numerically-adjacent integer values.</assert>
         <let name="tokenizedStaff"
               value="tokenize(normalize-space(string(@staff)), '\s+')"/>
         <let name="maxValue"
               value="max((number($tokenizedStaff[1]), number($tokenizedStaff[2])))"/>
         <let name="minValue"
               value="min((number($tokenizedStaff[1]), number($tokenizedStaff[2])))"/>
         <assert test="$maxValue - $minValue = 1">Staves <value-of select="$minValue"/> and <value-of select="$maxValue"/> are not adjacent.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-When_notationsubtype-5">
      <rule context="mei:*[@notationsubtype]">
         <assert test="@notationtype">An element with a notationsubtype attribute must have a notationtype attribute.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_beam_place-6">
      <rule context="mei:beam[@place eq 'mixed' and not(descendant::mei:*[local-name() eq 'note' or local-name() eq 'chord'][@staff != ./@staff] or descendant::mei:*[local-name() eq 'note' or local-name() eq 'chord'][@staff != ancestor::mei:staff/@n])]">
         <assert test="count(descendant::mei:*[local-name() eq 'note' or local-name() eq 'chord'][@stem.dir]) = count(descendant::mei:*[local-name() eq 'note' or local-name() eq 'chord'])"
                  role="warning">Stem directions should be specified for all notes and chords under the beam.</assert>
         <assert test="count(distinct-values(descendant::mei:*[local-name() eq 'note' or local-name() eq 'chord']/@stem.dir)) != 1">Opposing stem directions are required for a beam with @place="mixed".</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_beam_place-7">
      <rule context="mei:beam[@place eq 'mixed' and (descendant::mei:*[local-name() eq 'note' or local-name() eq 'chord'][@staff != ./@staff] or descendant::mei:*[local-name() eq 'note' or local-name() eq 'chord'][@staff != ancestor::mei:staff/@n]) and count(descendant::mei:*[local-name() eq 'note' or local-name() eq 'chord']/@stem.dir) = count(descendant::mei:*[local-name() eq 'note' or local-name() eq 'chord'])]">
         <assert test="count(distinct-values(descendant::mei:*[local-name() eq 'note' or local-name() eq 'chord']/@stem.dir)) != 1">Opposing stem directions are required for a beam with @place="mixed".</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-attacca_start-type_attributes_required-8">
      <rule context="mei:attacca[not(ancestor::mei:syllable)]">
         <assert test="@startid or @tstamp or @tstamp.ges or @tstamp.real">Must have one of the attributes: startid, tstamp, tstamp.ges or tstamp.real.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-When_not_copyof_beam_content-9">
      <rule context="mei:beam[not(@copyof or @sameas)]">
         <assert test="count(descendant::*[local-name()='note' or local-name()='rest' or               local-name()='chord' or local-name()='space']) &gt; 1">A beam that contains neither a copyof nor sameas attribute must have at least 2 note, rest, chord, or space descendants.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-beamspan_start-_and_end-type_attributes_required-10">
      <rule context="mei:beamSpan">
         <assert test="@startid or @tstamp or @tstamp.ges or @tstamp.real">Must have one of the attributes: startid, tstamp, tstamp.ges or tstamp.real.</assert>
         <assert test="@dur or @dur.ges or @endid or @tstamp2">Must have one of the attributes: dur, dur.ges, endid, or tstamp2.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-bend_start-_and_end-type_attributes_required-11">
      <rule context="mei:bend">
         <assert test="@startid or @tstamp or @tstamp.ges or @tstamp.real">Must have one of the attributes: startid, tstamp, tstamp.ges or tstamp.real.</assert>
         <assert test="@dur or @dur.ges or @endid or @tstamp2">Must have one of the attributes: dur, dur.ges, endid, or tstamp2.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-bracketSpan_start-_and_end-type_attributes_required-12">
      <rule context="mei:bracketSpan">
         <assert test="@startid or @tstamp or @tstamp.ges or @tstamp.real">Must have one of the attributes: startid, tstamp, tstamp.ges or tstamp.real.</assert>
         <assert test="@dur or @dur.ges or @endid or @tstamp2">Must have one of the attributes: dur, dur.ges, endid, or tstamp2.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-breath_start-type_attributes_required-13">
      <rule context="mei:breath">
         <assert test="@startid or @tstamp or @tstamp.ges or @tstamp.real">Must have one of the attributes: startid, tstamp, tstamp.ges or tstamp.real.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-fermata_start-type_attributes_required-14">
      <rule context="mei:fermata">
         <assert test="@startid or @tstamp or @tstamp.ges or @tstamp.real">Must have one of the attributes: startid, tstamp, tstamp.ges or tstamp.real.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-gliss_start-_and_end-type_attributes_required-15">
      <rule context="mei:gliss">
         <assert test="@startid or @tstamp or @tstamp.ges or @tstamp.real">Must have one of the attributes: startid, tstamp, tstamp.ges or tstamp.real.</assert>
         <assert test="@dur or @dur.ges or @endid or @tstamp2">Must have one of the attributes: dur, dur.ges, endid, or tstamp2.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-When_not_copyof_graceGrp_content-16">
      <rule context="mei:graceGrp[not(@copyof)]">
         <assert test="count(descendant::*[local-name()='note' or local-name()='rest' or               local-name()='chord' or local-name()='space']) &gt; 0">A graceGrp without a copyof attribute must have at least 1 note, rest, chord, or space descendants.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-When_graced-17">
      <rule context="mei:graceGrp[@grace]">
         <assert test="not(descendant::mei:*[@grace])">The grace attribute is not allowed on descendants of a graceGrp with a grace attribute.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-hairpin_start-_and_end-type_attributes_required-18">
      <rule context="mei:hairpin">
         <assert test="@startid or @tstamp or @tstamp.ges or @tstamp.real">Must have one of the attributes: startid, tstamp, tstamp.ges or tstamp.real.</assert>
         <assert test="@dur or @dur.ges or @endid or @tstamp2">Must have one of the attributes: dur, dur.ges, endid, or tstamp2.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-harpPedal_start-type_attributes_required-19">
      <rule context="mei:harpPedal">
         <assert test="@startid or @tstamp or @tstamp.ges or @tstamp.real">Must have one of the attributes: startid, tstamp, tstamp.ges or tstamp.real.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-lv_start-_and_end-type_attributes_required-20">
      <rule context="mei:lv">
         <assert test="@startid or @tstamp or @tstamp.ges or @tstamp.real">Must have one of the attributes: startid, tstamp, tstamp.ges or tstamp.real.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-lv_containing_curve-21">
      <rule context="mei:lv[mei:curve[@bezier or @bulge or @curvedir or @lform or @lwidth or @ho or @startho or @endho or @to or @startto or @endto or @vo or @startvo or              @endvo or @x or @y or @x2 or @y2]]">
         <assert test="not(@bezier or @bulge or @curvedir or @lform or @lwidth or @ho or @startho or @endho or @to or @startto or @endto or @vo or @startvo or @endvo or @x or @y or @x2 or @y2)"
                  role="warning">The visual attributes of the lv element (@bezier, @bulge, @curvedir, @lform, @lwidth, @ho, @startho, @endho, @to, @startto, @endto, @vo, @startvo, @endvo, @x, @y, @x2, and @y2) will be overridden by visual attributes of the contained curve elements.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-octave_start-_and_end-type_attributes_required-22">
      <rule context="mei:octave">
         <assert test="@startid or @tstamp or @tstamp.ges or @tstamp.real">Must have one of the attributes: startid, tstamp, tstamp.ges or tstamp.real.</assert>
         <assert test="@dur or @dur.ges or @endid or @tstamp2">Must have one of the attributes: dur, dur.ges, endid, or tstamp2.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-Check_ossia-1">
      <rule context="mei:measure/mei:ossia">
         <assert test="count(mei:*) = count(mei:staff)+count(mei:oStaff)">In a measure, ossia may only contain staff and oStaff elements.</assert>
      </rule>
      <rule context="mei:staff/mei:ossia">
         <assert test="count(mei:*) = count(mei:layer)+count(mei:oLayer)">In a staff, ossia may only contain layer and oLayer elements.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-pedal_start-type_attributes_required-25">
      <rule context="mei:pedal">
         <assert test="@startid or @tstamp or @tstamp.ges or @tstamp.real">Must have one of the attributes: startid, tstamp, tstamp.ges or tstamp.real.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-slur_start-_and_end-type_attributes_required-28">
      <rule context="mei:slur">
         <assert test="@startid or @tstamp or @tstamp.ges or @tstamp.real">Must have one of the attributes: startid, tstamp, tstamp.ges or tstamp.real.</assert>
         <assert test="@dur or @dur.ges or @endid or @tstamp2">Must have one of the attributes: dur, dur.ges, endid, or tstamp2.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-slur_containing_curve-29">
      <rule context="mei:slur[mei:curve[@bezier or @bulge or @curvedir or @lform or @lwidth or @ho or @startho or @endho or @to or @startto or @endto or @vo or @startvo or @endvo or @x or @y or @x2 or @y2]]">
         <assert test="not(@bezier or @bulge or @curvedir or @lform or @lwidth or @ho or @startho or @endho or @to or @startto or @endto or @vo or @startvo or @endvo or @x or @y or @x2 or @y2)"
                  role="warning">The visual attributes of the slur (@bezier, @bulge, @curvedir, @lform, @lwidth, @ho, @startho, @endho, @to, @startto, @endto, @vo, @startvo, @endvo, @x, @y, @x2, and @y2) will be overridden by visual attributes of the contained curve elements.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-tie_start-_and_end-type_attributes_required-30">
      <rule context="mei:tie">
         <assert test="@startid or @tstamp or @tstamp.ges or @tstamp.real">Must have one of the attributes: startid, tstamp, tstamp.ges or tstamp.real.</assert>
         <assert test="@dur or @dur.ges or @endid or @tstamp2">Must have one of the attributes: dur, dur.ges, endid, or tstamp2.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-tie_containing_curve-31">
      <rule context="mei:tie[mei:curve[@bezier or @bulge or @curvedir or @lform or @lwidth or @ho or @startho or @endho or @to or @startto or @endto or @vo or @startvo or @endvo or @x or @y or @x2 or @y2]]">
         <assert test="not(@bezier or @bulge or @curvedir or @lform or @lwidth or @ho or @startho or @endho or @to or @startto or @endto or @vo or @startvo or @endvo or @x or @y or @x2 or @y2)"
                  role="warning">The visual attributes of the tie (@bezier, @bulge, @curvedir, @lform, @lwidth, @ho, @startho, @endho, @to, @startto, @endto, @vo, @startvo, @endvo, @x, @y, @x2, and @y2) will be overridden by visual attributes of the contained curve elements.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-tupletSpan_start-_and_end-type_attributes_required-32">
      <rule context="mei:tupletSpan">
         <assert test="@startid or @tstamp or @tstamp.ges or @tstamp.real">Must have one of the attributes: startid, tstamp, tstamp.ges or tstamp.real.</assert>
         <assert test="@dur or @dur.ges or @endid or @tstamp2">Must have one of the attributes: dur, dur.ges, endid, or tstamp2.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-mordent_start-type_attributes_required-33">
      <rule context="mei:mordent">
         <assert test="@startid or @tstamp or @tstamp.ges or @tstamp.real">Must have one of the attributes: startid, tstamp, tstamp.ges or tstamp.real.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-trill_start-type_attributes_required-34">
      <rule context="mei:trill">
         <assert test="@startid or @tstamp or @tstamp.ges or @tstamp.real">Must have one of the attributes: startid, tstamp, tstamp.ges or tstamp.real.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-turn_start-type_attributes_required-35">
      <rule context="mei:turn">
         <assert test="@startid or @tstamp or @tstamp.ges or @tstamp.real">Must have one of the attributes: startid, tstamp, tstamp.ges or tstamp.real.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-sp_start-type_attributes_required-36">
      <rule context="mei:sp[ancestor::mei:layer or ancestor::mei:measure or ancestor::mei:staff][not(ancestor::mei:sp)]">
         <assert test="@startid or @tstamp or @tstamp.ges or @tstamp.real">Must have one of the attributes: startid, tstamp, tstamp.ges or tstamp.real.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-sp_start-type_attributes_forbidden-37">
      <rule context="mei:sp[not(ancestor::mei:layer or ancestor::mei:measure or ancestor::mei:staff)]">
         <assert test="not(@startid or @endid or @tstamp or @tstamp2 or @tstamp.ges or @tstamp.real or                @startho or @endho or @to or @startto or @endto or @staff or @layer or @place or @plist)">Must not have any of the attributes: startid, endid, tstamp, tstamp2, tstamp.ges, tstamp.real, startho, endho, to, startto, endto, staff, layer, place, or plist.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-stageDir_start-type_attributes_required-38">
      <rule context="mei:stageDir[ancestor::mei:layer or ancestor::mei:measure or ancestor::mei:staff][not(ancestor::mei:sp)]">
         <assert test="@startid or @tstamp or @tstamp.ges or @tstamp.real">Must have one of the attributes: startid, tstamp, tstamp.ges or tstamp.real.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-stageDir_start-type_attributes_forbidden-39">
      <rule context="mei:stageDir[not(ancestor::mei:layer or ancestor::mei:measure or ancestor::mei:staff) or ancestor::mei:sp]">
         <assert test="not(@startid or @endid or @tstamp or @tstamp2 or @tstamp.ges or @tstamp.real or @startho or @endho or @to or                @startto or @endto or @staff or @layer or @place or @plist)">Must not have any of the attributes: startid, endid, tstamp, tstamp2, tstamp.ges, tstamp.real, startho, endho, to, startto, endto, staff, layer, place, or plist.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-cpMark_start-_and_end-type_attributes_required-40">
      <rule context="mei:cpMark">
         <assert test="@startid or @tstamp or @tstamp.ges or @tstamp.real">Must have one of the attributes: startid, tstamp, tstamp.ges or tstamp.real</assert>
         <assert test="@dur or @dur.ges or @endid or @tstamp2">Must have one of the attributes: dur, dur.ges, endid, or tstamp2</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_newTarget-41">
      <rule context="@new">
         <assert role="warning" test="not(normalize-space(.) eq '')">@new attribute should have content.</assert>
         <assert role="warning"
                  test="every $i in tokenize(., '\s+') satisfies substring($i,2)=//mei:hand/@xml:id">The value in @new should correspond to the @xml:id attribute of a hand element.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_oldTarget-42">
      <rule context="@old">
         <assert role="warning" test="not(normalize-space(.) eq '')">@old attribute should have content.</assert>
         <assert role="warning"
                  test="every $i in tokenize(., '\s+') satisfies substring($i,2)=//mei:hand/@xml:id">The value in @old should correspond to the @xml:id attribute of a hand element.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-metaMark_start-type_attributes_required-43">
      <rule context="mei:metaMark">
         <assert test="@startid or @tstamp or @tstamp.ges or @tstamp.real">Must have one of the attributes: startid, tstamp, tstamp.ges or tstamp.real</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_glyph.name-44">
      <rule context="@glyph.name">
         <assert role="warning" test="not(normalize-space(.) eq '')">@glyph.name attribute should have content.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_glyph.num-45">
      <rule context="mei:*[@glyph.num and (lower-case(@glyph.auth) eq 'smufl' or @glyph.uri eq 'http://www.smufl.org/')]">
         <assert role="warning"
                  test="matches(normalize-space(@glyph.num), '^(#x|U\+)E([0-9AB][0-9A-F][0-9A-F]|C[0-9A][0-9A-F]|CB[0-9A-F])$')">SMuFL version 1.18 uses the range U+E000 - U+ECBF.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_facsTarget-46">
      <rule context="@facs">
         <assert role="warning" test="not(normalize-space(.) eq '')">@facs attribute should have content.</assert>
         <assert role="warning"
                  test="every $i in tokenize(., '\s+') satisfies substring($i,2)=//mei:*[local-name() eq 'surface' or local-name() eq 'zone']/@xml:id">Each value in @facs should correspond to the @xml:id attribute of a surface or zone element.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-graphic_attributes-47">
      <rule context="mei:zone/mei:graphic">
         <assert role="warning" test="count(mei:*) = 0">Graphic child of zone should not have children.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-graphic_attributes-48">
      <rule context="mei:symbolDef/mei:graphic">
         <assert role="warning" test="@startid or (@ulx and @uly)">Graphic should have either a startid attribute or ulx and uly attributes.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-graphic_attributes-49">
      <rule context="mei:graphic[not(ancestor::mei:symbolDef or ancestor::mei:zone)]">
         <assert role="warning" test="not(@ulx or @uly)">Graphic should not have @ulx or @uly attributes.</assert>
         <assert role="warning" test="not(@ho or @vo)">Graphic should not have @ho or @vo attributes.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-fing_start-type_attributes_required-50">
      <rule context="mei:fing[not(ancestor::mei:fingGrp)]">
         <assert test="@startid or @tstamp or @tstamp.ges or @tstamp.real">Must have one of the attributes: startid, tstamp, tstamp.ges or tstamp.real.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-stack_exclusion-51">
      <rule context="mei:fing">
         <assert test="not(descendant::mei:stack)">The stack element is not allowed as a descendant of fing.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-require_fingeringLike_children-52">
      <rule context="mei:fingGrp">
         <assert test="count(mei:fing) + count(mei:fingGrp) &gt; 1">At least 2 fing or fingGrp elements are required.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_fingGrp_start-type_attributes-2">
      <rule context="mei:fingGrp[not(ancestor::mei:fingGrp)][@tstamp or @startid]">
         <assert test="not(child::mei:*[@tstamp or @startid])">When @tstamp or @startid is present on fingGrp, its child elements cannot have a @tstamp or @startid attribute.</assert>
      </rule>
      <rule context="mei:fingGrp[not(ancestor::mei:fingGrp)][not(@tstamp or @startid)]">
         <assert test="count(descendant::mei:*[@tstamp or @startid]) = count(child::mei:*[local-name()='fing' or local-name()='fingGrp'])">When @tstamp or @startid is not present on fingGrp, each of its child elements must have a @tstamp or @startid attribute.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_singleton-55">
      <rule context="mei:manifestation[@singleton eq 'true']">
         <assert test="not(mei:itemList)">Item children are not permitted when @singleton equals "true".</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_singleton_availability-56">
      <rule context="mei:manifestation[@singleton eq 'false'] | mei:manifestation[not(@singleton)]">
         <assert test="not(mei:availability)">Availability is only permitted when @singleton equals "true".</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_changeState.targets-57">
      <rule context="@state">
         <assert role="warning" test="not(normalize-space(.) eq '')">@state attribute should have content.</assert>
         <assert role="warning"
                  test="every $i in tokenize(., '\s+') satisfies substring($i,2)=//mei:genState/@xml:id">The value in @state should correspond to the @xml:id attribute of a genState (genetic state) element.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_accid_duplication-58">
      <rule context="@accid.ges">
         <assert role="warning" test="not(. eq ../@accid)">The value of @accid.ges should not duplicate the value of @accid.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-extremis_disallows_gestural_pitch-59">
      <rule context="mei:note[@extremis]">
         <assert test="not(@pname.ges) and not(@oct.ges)">When the @extremis attribute is used, the @pname.ges and @oct.ges attributes are not allowed.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_chordrefTarget-60">
      <rule context="@chordref">
         <assert role="warning" test="not(normalize-space(.) eq '')">@chordref attribute should have content.</assert>
         <assert role="warning"
                  test="every $i in tokenize(., '\s+') satisfies substring($i,2)=//mei:chordDef/@xml:id">The value in @chordref should correspond to the @xml:id attribute of a chordDef element.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-harm_start-type_attributes_required-61">
      <rule context="mei:harm">
         <assert test="@startid or @tstamp or @tstamp.ges or @tstamp.real">Must have one of the attributes: startid, tstamp, tstamp.ges or tstamp.real.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-context_attribute_requires_content-62">
      <rule context="@context">
         <assert role="warning" test="not(normalize-space(.) eq '')">@context attribute should contain an XPath expression.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-category_id-63">
      <rule context="mei:category">
         <assert test="@xml:id" role="warning">To be addressable, the category element must have an xml:id attribute.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_change-64">
      <rule context="mei:change">
         <assert test="@isodate or mei:date">The date of the change must be recorded in an isodate attribute or date element.</assert>
         <assert test="@resp or mei:respStmt[mei:name or mei:corpName or mei:persName]"
                  role="warning">It is recommended that the agent responsible for the change be recorded in a resp attribute or in a name, corpName, or persName element in the respStmt element.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-checkComponentList-65">
      <rule context="mei:componentList">
         <assert test="every $i in ./child::mei:*[not(local-name()='head')] satisfies             $i/local-name() eq ./parent::mei:*/local-name()">Only child elements of the same name as the parent of the componentList are allowed.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-checkComponents-66">
      <rule context="mei:componentList[mei:*[@comptype]]">
         <assert role="warning"
                  test="count(mei:*[@comptype]) = count(mei:*[local-name() ne 'head'])">When any child element has a comptype attribute, it is recommended that comptype appear on all child elements.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-checkContentsLabels-67">
      <rule context="mei:contents[mei:label]">
         <assert role="warning" test="count(mei:label) = count(mei:contentItem)">When labels are used, usually each content item has one.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-checkHandListLabels-68">
      <rule context="mei:handList[mei:label]">
         <assert role="warning" test="count(mei:label) = count(mei:hand)">When labels are used, usually each hand has one.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-history_restriction-69">
      <rule context="mei:history[parent::mei:work or parent::mei:expression or parent::mei:manifestation[not(@singleton='true')]]">
         <assert test="not(mei:acquisition or mei:provenance or mei:exhibHist or mei:treatHist or mei:treatSched)">The elements acquisition, provenance, exhibHist, treatHist and treatSched are not permitted at the work or expression level and are only permitted at the manifestation level, if the manifestation is a manifestation singleton.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-Check_incipCode_form_mimetype-70">
      <rule context="mei:incipCode">
         <assert test="@form or @mimetype">incipCode must have a form or mimetype attribute.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_meiHead_type-71">
      <rule context="mei:meiHead[@type eq 'music']">
         <assert test="ancestor::mei:mei">The meiHead type attribute can have the value 'music' only when the document element is "mei".</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_meiHead_type-72">
      <rule context="mei:meiHead[@type eq 'corpus']">
         <assert test="ancestor::mei:meiCorpus">The meiHead type attribute can have the value 'corpus' only when the document element is "meiCorpus".</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_meiHead_type-73">
      <rule context="mei:meiHead[@type eq 'independent']">
         <assert test="not(ancestor::mei:*)">The meiHead type attribute can have the value 'independent' only when the document element is "meiHead".</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_attached_position-74">
      <rule context="mei:patch">
         <assert test="(parent::mei:folium and @attached.to = ('recto','verso')) or              (parent::mei:bifolium and @attached.to = ('outer.recto','inner.verso','inner.recto','outer.verso'))">The allowed positions of a patch depend on its parent element.</assert>
         <assert test="count(child::node()) gt 0">A patch element must contain either a folium or a bifolium element.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_source_target-75">
      <rule context="mei:source/@target">
         <assert role="warning" test="not(normalize-space(.) eq '')">@target attribute should have content.</assert>
         <assert role="warning"
                  test="every $i in tokenize(., '\s+') satisfies substring($i,2)=//mei:*[local-name()              eq 'source' or local-name() eq 'manifestation']/@xml:id or matches($i, '^([a-z]+://|\.{1,2}/)')">Each value in @target should correspond to the @xml:id attribute of a source or manifestation element or be an external URI.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-context_attribute_requires_content-76">
      <rule context="@context">
         <assert role="warning" test="not(normalize-space(.) eq '')">@context attribute should contain an XPath expression.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-checkTermListLabels-77">
      <rule context="mei:termList[mei:label]">
         <assert role="warning" test="count(mei:label) = count(mei:term)">When labels are used, usually each term has one.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_duplex_quality-78">
      <rule context="(mei:note|mei:space)[@dur.quality='duplex']">
         <assert test="@dur='longa'"> Duplex quality can only be used with longas (in Ars antiqua).</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_maiorminor_quality-79">
      <rule context="(mei:note|mei:space)[@dur.quality='maior' or @dur.quality='minor']">
         <assert test="@dur='semibrevis'"> Maior / minor quality can only be used with semibreves (in Ars antiqua).</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-mensuration_conflicting_attributes-80">
      <rule context="mei:mensur[@divisio]">
         <assert test="not(@tempus) and not(@prolatio)"> When the @divisio attribute is used, the @tempus and @prolatio attributes are not allowed.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-Check_plica-81">
      <rule context="mei:plica">
         <assert test="count(../mei:plica) &lt;= 1">Only one plica is allowed.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-Check_stem-82">
      <rule context="mei:stem">
         <assert test="not(ancestor::mei:note/@*[starts-with(local-name(),'stem.')])">A note with nested stem elements must not have @stem.* attributes.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_instrTarget-83">
      <rule context="@instr">
         <assert role="warning" test="not(normalize-space(.) eq '')">@instr attribute should have content.</assert>
         <assert role="warning"
                  test="every $i in tokenize(., '\s+') satisfies substring($i,2)=//mei:instrDef/@xml:id">The value in @instr should correspond to the @xml:id attribute of an instrDef element.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-One_of_instrname_or_instrnum-84">
      <rule context="mei:*[@midi.instrname]">
         <assert test="not(@midi.instrnum)">Only one of @midi.instrname and @midi.instrnum allowed.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-One_of_patchname_or_patchnum-85">
      <rule context="mei:*[@midi.patchname]">
         <assert test="not(@midi.patchnum)">Only one of @midi.patchname and @midi.patchnum allowed.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-checkComponentType-86">
      <rule context="mei:*[@comptype]">
         <let name="elementName" value="local-name()"/>
         <assert test="ancestor::mei:componentList">The comptype attribute may occur on <value-of select="$elementName"/> only when it is a descendant of a componentList.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_catchwords_inline-87">
      <rule context="mei:catchwords">
         <assert test="ancestor::mei:physDesc">The catchwords element may only appear as a descendant of the physDesc element.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_locusGrp_inline-88">
      <rule context="mei:locusGrp">
         <assert test="ancestor::mei:physDesc or parent::mei:contentItem or              ancestor::mei:source[ancestor::mei:componentList[ancestor::mei:sourceDesc or              ancestor::mei:sourceList or ancestor::mei:workList]]">The locusGrp element may only appear as a descendant of a physDesc element, a contentItem element, or a source element that is a component of another source or work.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_secFolio_inline-89">
      <rule context="mei:secFolio">
         <assert test="ancestor::mei:physDesc">The secFolio element may only appear as a descendant of the physDesc element.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_signatures_inline-90">
      <rule context="mei:signatures">
         <assert test="ancestor::mei:physDesc">The signatures element may only appear as a descendant of the physDesc element.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_whenTarget-91">
      <rule context="@when">
         <assert role="warning" test="not(normalize-space(.) eq '')">@when attribute should have content.</assert>
         <assert role="warning"
                  test="every $i in tokenize(., '\s+') satisfies substring($i,2)=//mei:when/@xml:id">A value in @when should correspond to the @xml:id attribute of a when element.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-avFile_child_of_clip-92">
      <rule context="mei:clip/mei:avFile">
         <assert test="count(mei:*) = 0">An avFile child of clip cannot have children.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-betype_required_when_begin_or_end-93">
      <rule context="mei:clip[@begin or @end]">
         <assert role="warning" test="@betype or ancestor::mei:*[@betype]">When @begin or @end is used, @betype should appear on clip or one of its ancestors.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-recording-names-a-take-94">
      <rule context="mei:performance/mei:recording">
         <assert test="@source">A recording must name its take in @source, so that a document holding several takes can say which one a when belongs to.</assert>
         <assert test="not(@source) or (starts-with(@source, '#') and //*[@xml:id = substring-after(current()/@source, '#')])">The @source of a recording must be a reference of the form '#id' resolving to an element of this document, usually a manifestation.</assert>
         <assert test="not(@source) or count(../mei:recording[@source = current()/@source]) = 1">Two recordings carry the same @source, so neither can be selected by it.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-betype_required_when_begin_or_end-95">
      <rule context="mei:recording[@begin or @end]">
         <assert role="warning" test="@betype">When @begin or @end is used, @betype should be present.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-when-shapes-96">
      <rule context="mei:recording/mei:when[@type = 'match']">
         <assert test="@data">A match names the written note in @data.</assert>
         <assert test="@absolute">A match names the moment it sounded in @absolute.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-when-shapes-97">
      <rule context="mei:recording/mei:when[@type = 'deletion']">
         <assert test="@data">A deletion names the written note in @data.</assert>
         <assert test="not(@absolute)">A deletion has no @absolute, because the note was never played.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-when-shapes-98">
      <rule context="mei:recording/mei:when[@type = 'insertion']">
         <assert test="not(@data)">An insertion has no @data, because there is no written note for it to point at.</assert>
         <assert test="@absolute">An insertion names the moment it sounded in @absolute.</assert>
         <assert test="mei:extData[@type = 'pitch']">An insertion carries the pitch that sounded in extData of type 'pitch', since the score does not give it.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-when-shapes-99">
      <rule context="mei:recording/mei:when[@type = 'substitution']">
         <assert test="@data">A substitution names the written note in @data.</assert>
         <assert test="@absolute">A substitution names the moment it sounded in @absolute.</assert>
         <assert test="mei:extData[@type = 'pitch']">A substitution carries the pitch that sounded in extData of type 'pitch', which is what makes it a substitution rather than a match.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-when-shapes-100">
      <rule context="mei:recording/mei:when[@type = 'sustain' or @type = 'soft']">
         <assert test="not(@data)">A pedal event has no @data, because it realises no written note.</assert>
         <assert test="@absolute">A pedal event names the moment it was pressed in @absolute.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-when-points-into-the-score-101">
      <rule context="mei:recording/mei:when[@data]">
         <assert test="starts-with(@data, '#') and //*[@xml:id = substring-after(current()/@data, '#')]">The @data of a when must be a reference of the form '#id' resolving to an element of this document.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-when-absolute-in-whole-milliseconds-102">
      <rule context="mei:recording/mei:when[@absolute]">
         <assert test="matches(@absolute, '^[0-9]+ms$')">The @absolute of a when is written in whole milliseconds with the 'ms' unit. Other forms MEI allows are read differently by the two readers this format serves.</assert>
         <assert test="@abstype = 'smil'">A when carrying @absolute states @abstype='smil'; the verovio fork warns on any other value.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-when-ornament-fields-belong-together-103">
      <rule context="mei:recording/mei:when">
         <assert test="not(mei:extData[@type = 'ornamentAnchorConfidence']) or mei:extData[@type = 'ornamentAnchorConfidenceOf']">An ornamentAnchorConfidence is written together with an ornamentAnchorConfidenceOf naming which quantity it holds. An unlabelled number cannot be compared across files.</assert>
         <assert test="not(mei:extData[@type = 'ornamentAnchorFrom' or @type = 'ornamentAnchorConfidence' or @type = 'ornamentSlot']) or mei:extData[@type = 'ornamentAnchor']">The ornament fields describe an anchor, so they require an ornamentAnchor to describe.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_when_interval-104">
      <rule context="mei:when[@interval]">
         <assert test="@since">@since must be present when @interval is used.</assert>
         <assert role="warning"
                  test="every $i in tokenize(@since, '\s+') satisfies substring($i,2)=//mei:when/@xml:id">The value in @since should correspond to the @xml:id attribute of a when element.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_when_interval-105">
      <rule context="mei:when[matches(@interval, '^[0-9]+$')]">
         <assert test="not(@inttype eq 'time')">When @interval contains an integer value, @inttype cannot be 'time'.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_when_interval-106">
      <rule context="mei:when[matches(@interval, ':')]">
         <assert test="@inttype eq 'time'">When @interval contains a time value, @inttype must be 'time'.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_when_absolute-107">
      <rule context="mei:when[@absolute]">
         <assert role="warning" test="@abstype or ancestor::mei:*[@betype]">When @absolute is present, @abstype should be present or @betype should be present on an ancestor.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_sinceTarget-108">
      <rule context="@since">
         <assert role="warning" test="not(normalize-space(.) eq '')">@since attribute should have content.</assert>
         <assert role="warning"
                  test="every $i in tokenize(., '\s+') satisfies substring($i,2)=//mei:when/@xml:id">The value in @since should correspond to the @xml:id attribute of a when element.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_sinceTarget-109">
      <rule context="@since">
         <assert role="warning" test="not(normalize-space(.) eq '')">@since attribute should have content.</assert>
         <assert role="warning"
                  test="every $i in tokenize(., '\s+') satisfies substring($i,2)=//mei:when/@xml:id">The value in @since should correspond to the @xml:id attribute of a when element.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_attaccaTarget-110">
      <rule context="mei:attacca/@target">
         <assert role="warning" test="not(normalize-space(.) eq '')">@target attribute should have content.</assert>
         <assert role="warning"
                  test="every $i in tokenize(., '\s+') satisfies substring($i,2)=//mei:*[local-name() eq 'section' or local-name() eq 'mdiv']/@xml:id">The value in @target should correspond to the @xml:id attribute of a section or mdiv element.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-dots_attribute_requires_dur-111">
      <rule context="mei:*[@dots]">
         <assert test="@dur">An element with a dots attribute must also have a dur attribute.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_barmethod-112">
      <rule context="@bar.method[parent::*[matches(local-name(), '(staffDef|measure)')]]">
         <assert test="not(. eq 'mensur')">"mensur" not allowed in this context.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_classURI-113">
      <rule context="@class">
         <assert test="every $i in tokenize(., '\s+') satisfies substring($i,2)=//mei:category/@xml:id or matches($i, '^([a-z]+://|\.{1,2}/)')">The value in @class must either correspond to the @xml:id attribute of a category element or be an external URL.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-clef_shape_requires_clef_line-114">
      <rule context="mei:*[matches(@clef.shape, '[FCG]')]">
         <assert test="@clef.line">An 'F', 'C', or 'G' clef requires that its position be specified.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-clef_shape_requires_clef_line-115">
      <rule context="mei:*[matches(@clef.shape, '(TAB|perc)')]">
         <assert test="@lines">A TAB or percussion clef requires that the number of lines be specified.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-shape_requires_line-116">
      <rule context="mei:clef[matches(@shape, '[FCG]')]">
         <assert test="@line">When @shape is present, @line must also be specified.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_custosTarget-117">
      <rule context="mei:custos/@target">
         <assert role="warning" test="not(normalize-space(.) eq '')">@target attribute should have content.</assert>
         <assert role="warning"
                  test="every $i in tokenize(., '\s+') satisfies substring($i,2)=//mei:note/@xml:id">The value in @target should correspond to the @xml:id attribute of a note element.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_dataTarget-118">
      <rule context="@data">
         <assert role="warning" test="not(normalize-space(.) eq '')">@data attribute should have content.</assert>
         <assert role="warning"
                  test="every $i in tokenize(., '\s+') satisfies substring($i,2)=//mei:*[ancestor::mei:music]/@xml:id">The value in @data should correspond to the @xml:id attribute of a descendant of the music element.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_declsTarget-119">
      <rule context="@decls">
         <assert role="warning" test="not(normalize-space(.) eq '')">@decls attribute should have content.</assert>
         <assert role="warning"
                  test="every $i in tokenize(., '\s+') satisfies substring($i,2)=//mei:*[ancestor::mei:meiHead]/@xml:id">Each value in @decls should correspond to the @xml:id attribute of an element within the metadata header.</assert>
         <assert test="every $i in tokenize(., '\s+') satisfies not(substring($i,2)=//mei:term/@xml:id)">No value in @decls should correspond to the @xml:id attribute of a classification term. Use @class for this purpose.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_extent-120">
      <rule context="@extent[matches(normalize-space(.), '^\d+(\.\d+)?$')]">
         <assert role="warning" test="../@unit">The @unit attribute is recommended.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_extent-121">
      <rule context="@extent[matches(., '\d+(\.\d+)?\s')]">
         <assert role="warning" test="../@unit">Separation into value (@extent) and unit (@unit) is recommended.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_handTarget-122">
      <rule context="@hand">
         <assert role="warning" test="not(normalize-space(.) eq '')">@hand attribute should have content.</assert>
         <assert role="warning"
                  test="every $i in tokenize(., '\s+') satisfies substring($i,2)=//mei:hand/@xml:id">Each value in @hand should correspond to the @xml:id attribute of a hand element.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_joinTarget-123">
      <rule context="@join">
         <assert role="warning" test="not(normalize-space(.) eq '')">@join attribute should have content.</assert>
         <assert role="warning"
                  test="every $i in tokenize(., '\s+') satisfies substring($i,2)=//mei:*/@xml:id">Each value in @join should correspond to the @xml:id attribute of an element.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_defTarget_layer-124">
      <rule context="mei:layer/@def">
         <assert role="warning" test="not(normalize-space(.) eq '')">@def attribute should have content.</assert>
         <assert role="warning"
                  test="every $i in tokenize(., '\s+') satisfies substring($i,2)=//mei:layerDef/@xml:id">The value in @def should correspond to the @xml:id attribute of a layerDef element.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_lsegs-125">
      <rule context="@lsegs">
         <assert test="matches(../@lform, '(dashed|dotted|wavy)')">@lform attribute matching "dashed", "dotted", or "wavy" required.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-When_copyof_element_empty-126">
      <rule context="mei:*[@copyof]">
         <assert test="count(child::*[not(comment() or processing-instruction())]) = 0">An element with a copyof attribute can only have comment or processing instruction descendents.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_copyofTarget-127">
      <rule context="@copyof">
         <assert role="warning" test="not(normalize-space(.) eq '')">@copyof attribute should have content.</assert>
         <assert role="warning"
                  test="every $i in tokenize(., '\s+') satisfies substring($i,2)=//mei:*/@xml:id">The value in @copyof should correspond to the @xml:id attribute of an element.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_correspTarget-128">
      <rule context="@corresp">
         <assert role="warning" test="not(normalize-space(.) eq '')">@corresp attribute should have content.</assert>
         <assert role="warning"
                  test="every $i in tokenize(., '\s+') satisfies substring($i,2)=//mei:*/@xml:id">Each value in @corresp should correspond to the @xml:id attribute of an element.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_followsTarget-129">
      <rule context="@follows">
         <assert role="warning" test="not(normalize-space(.) eq '')">@follows attribute should have content.</assert>
         <assert role="warning"
                  test="every $i in tokenize(., '\s+') satisfies substring($i,2)=//mei:*/@xml:id">Each value in @follows must correspond to the @xml:id attribute of an element.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_nextTarget-130">
      <rule context="@next">
         <assert role="warning" test="not(normalize-space(.) eq '')">@next attribute should have content.</assert>
         <assert role="warning"
                  test="every $i in tokenize(., '\s+') satisfies substring($i,2)=//mei:*/@xml:id">Each value in @next should correspond to the @xml:id attribute of an element.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_precedesTarget-131">
      <rule context="@precedes">
         <assert role="warning" test="not(normalize-space(.) eq '')">@precedes attribute should have content.</assert>
         <assert role="warning"
                  test="every $i in tokenize(., '\s+') satisfies substring($i,2)=//mei:*/@xml:id">Each value in @precedes must correspond to the @xml:id attribute of an element.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_prevTarget-132">
      <rule context="@prev">
         <assert role="warning" test="not(normalize-space(.) eq '')">@prev attribute should have content.</assert>
         <assert role="warning"
                  test="every $i in tokenize(., '\s+') satisfies substring($i,2)=//mei:*/@xml:id">Each value in @prev should correspond to the @xml:id attribute of an element.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_sameasTarget-133">
      <rule context="@sameas">
         <assert role="warning" test="not(normalize-space(.) eq '')">@sameas attribute should have content.</assert>
         <assert role="warning"
                  test="every $i in tokenize(., '\s+') satisfies substring($i,2)=//mei:*/@xml:id">Each value in @sameas should correspond to the @xml:id attribute of an element.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_synchTarget-134">
      <rule context="@synch">
         <assert role="warning" test="not(normalize-space(.) eq '')">@synch attribute should have content.</assert>
         <assert role="warning"
                  test="every $i in tokenize(., '\s+') satisfies substring($i,2)=//mei:*/@xml:id">Each value in @synch should correspond to the @xml:id attribute of an element.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-meiVersion.onlyRoot-135">
      <rule context="/mei:*//*">
         <report test="@meiversion">The @meiversion attribute is not allowed on elements that are not the document root element.</report>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_nymrefTarget-136">
      <rule context="@nymref">
         <assert role="warning" test="not(normalize-space(.) eq '')">@nymref attribute should have content.</assert>
         <assert role="warning"
                  test="every $i in tokenize(., '\s+') satisfies substring($i,2)=//mei:*/@xml:id">The value in @nymref should correspond to the @xml:id attribute of an element.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_head.altsymTarget-137">
      <rule context="@head.altsym">
         <assert role="warning" test="not(normalize-space(.) eq '')">@head.altsym attribute should have content.</assert>
         <assert role="warning"
                  test="every $i in tokenize(., '\s+') satisfies substring($i,2)=//mei:symbolDef/@xml:id">The value in @head.altsym should correspond to the @xml:id attribute of a symbolDef element.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_head.auth-138">
      <rule context="mei:*[lower-case(@head.auth) eq 'smufl']">
         <assert test="matches(@head.shape, '^#x') or matches(@head.shape, '^U+')">When @head.auth matches 'smufl', @head.shape must contain a numeric glyph reference in hexadecimal notation, like "#xE000" or "U+E000".</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_headshape_num-139">
      <rule context="mei:*[(matches(@head.shape, '#x') or matches(@head.shape, 'U+')) and (lower-case(@head.auth) eq 'smufl')]">
         <assert role="warning"
                  test="matches(normalize-space(@head.shape), '^(#x|U\+)E([0-9AB][0-9A-F][0-9A-F]|C[0-9A][0-9A-F]|CB[0-9A-F])$')">SMuFL version 1.18 uses the range U+E000 - U+ECBF.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-origin.tstamp2_requires_origin.tstamp-140">
      <rule context="mei:*[@origin.tstamp2]">
         <assert test="@origin.tstamp">When @origin.tstamp2 is used @origin.tstamp must also be present.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_part_attr_all-141">
      <rule context="@part[some $i in tokenize(., '\s+') satisfies (matches($i, '^%all$'))]">
         <assert test="count(tokenize(., '\s+')) = 1">'%all' cannot be mixed with other values.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_partstaff_attr_all-142">
      <rule context="@partstaff[some $i in tokenize(., '\s+') satisfies (matches($i, '^%all$'))]">
         <assert test="count(tokenize(., '\s+')) = 1">'%all' cannot be mixed with other values.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_plistTarget-143">
      <rule context="@plist">
         <assert role="warning" test="not(normalize-space(.) eq '')">@plist attribute should have content.</assert>
         <assert role="warning"
                  test="every $i in tokenize(., '\s+') satisfies substring($i,2)=//mei:*/@xml:id">Each value in @plist should correspond to the @xml:id attribute of an element.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_confidence-144">
      <rule context="mei:*[@confidence]">
         <assert test="@min and @max">The attributes @min and @max are required when @confidence is present.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_respTarget-145">
      <rule context="@resp">
         <assert role="warning" test="not(normalize-space(.) eq '')">@resp attribute should have content.</assert>
         <assert role="warning"
                  test="every $i in tokenize(., '\s+') satisfies substring($i,2)=//mei:*[ancestor::mei:meiHead]/@xml:id">The value in @resp should correspond to the @xml:id attribute of an element within the metadata header.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_sourceTarget-146">
      <rule context="@source">
         <assert role="warning" test="not(normalize-space(.) eq '')">@source attribute should have content.</assert>
         <assert role="warning"
                  test="every $i in tokenize(., '\s+') satisfies substring($i,2)=//mei:*[local-name() eq 'source' or local-name() eq 'manifestation']/@xml:id">Each value in @source should correspond to the @xml:id attribute of a source or manifestation element.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_defTarget_staff-147">
      <rule context="mei:staff/@def">
         <assert role="warning" test="not(normalize-space(.) eq '')">@def attribute should have content.</assert>
         <assert role="warning"
                  test="every $i in tokenize(., '\s+') satisfies substring($i,2)=//mei:staffDef/@xml:id">The value in @def should correspond to the @xml:id attribute of a staffDef element.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_endidTarget-148">
      <rule context="@endid">
         <assert role="warning" test="not(normalize-space(.) eq '')">@endid attribute should have content.</assert>
         <assert role="warning"
                  test="every $i in tokenize(., '\s+') satisfies substring($i,2)=//mei:*/@xml:id">The value in @endid should correspond to the @xml:id attribute of an element.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_startidTarget-149">
      <rule context="@startid">
         <assert role="warning" test="not(normalize-space(.) eq '')">@startid attribute should have content.</assert>
         <assert role="warning"
                  test="every $i in tokenize(., '\s+') satisfies substring($i,2)=//mei:*/@xml:id">The value in @startid should correspond to the @xml:id attribute of an element.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_stem.sameasTarget-150">
      <rule context="@stem.sameas">
         <let name="layer.n" value="self::node()/ancestor::mei:layer/@n"/>
         <let name="ref.id" value="substring(.,2)"/>
         <assert role="warning" test="not(normalize-space(.) eq '')">@stem.sameas attribute should have content.</assert>
         <assert role="warning"
                  test="substring(.,2)=//mei:note[not(ancestor::mei:layer/@n=$layer.n)]/@xml:id"> The value in @stem.sameas should correspond to the @xml:id attribute of the linked note element of a different layer.</assert>
         <assert role="warning" test="../@dur=//mei:note[@xml:id=$ref.id]/@dur"> The linked notes by @stem.sameas should have the same @dur values.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-Check_annot_data-151">
      <rule context="mei:annot[@data]">
         <assert test="ancestor::mei:notesStmt">The @data attribute may only occur on an annotation within the notesStmt element.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-checkBiblLabels-152">
      <rule context="mei:biblList[mei:label]">
         <assert role="warning" test="count(mei:label) = count(mei:bibl)">When labels are used, usually each bibliographic item has one.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-caesura_start-type_attributes_required-153">
      <rule context="mei:caesura">
         <assert test="@startid or @tstamp or @tstamp.ges or @tstamp.real">Must have one of the attributes: startid, tstamp, tstamp.ges or tstamp.real.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_cb-154">
      <rule context="mei:cb">
         <let name="totalColumns" value="preceding::mei:colLayout[1]/@cols"/>
         <assert test="preceding::mei:colLayout">Column beginning must be preceded by a colLayout element.</assert>
         <assert test="@n &lt;= $totalColumns">The value of @n should be less than or equal to the value of @cols (<value-of select="$totalColumns"/>) of the preceding colLayout element.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-Clef_position_lines-155">
      <rule context="mei:clef[matches(@shape, '[FCG]')][ancestor::mei:staffDef[@lines]]">
         <let name="thisstaff" value="ancestor::mei:staffDef/@n"/>
         <assert test="number(@line) &lt;= number(ancestor::mei:staffDef[@n=$thisstaff and @lines][1]/@lines)">The clef position must be less than or equal to the number of lines of an ancestor staff.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-Clef_position_nolines-156">
      <rule context="mei:clef[ancestor::mei:staffDef[not(@lines)]]">
         <let name="thisstaff" value="ancestor::mei:staffDef/@n"/>
         <assert test="number(@line) &lt;= number(preceding::mei:staffDef[@n=$thisstaff and @lines][1]/@lines)">The clef position must be less than or equal to the number of lines of a preceding staff.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_contributor_role-157">
      <rule context="mei:contributor">
         <assert test="not(matches(normalize-space(lower-case(@role)), '(arranger|author|composer|contributor|editor|funder|librettist|lyricist|sponsor)'))">The value of @role must not contain the name of another element available in this context.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_dedicatee-158">
      <rule context="mei:dedicatee">
         <assert test="not(ancestor::mei:dedicatee)">The dedicatee element may not be recursively nested.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_dimensions-159">
      <rule context="mei:physDesc/mei:dimensions">
         <assert test="not(count(mei:depth) &gt; 1)">The depth element may only appear once.</assert>
         <assert test="not(count(mei:height) &gt; 1)">The height element may only appear once.</assert>
         <assert test="not(count(mei:width) &gt; 1)">The width element may only appear once.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-dir_start-type_attributes_required-160">
      <rule context="mei:dir[not(ancestor::mei:syllable)]">
         <assert test="@startid or @tstamp or @tstamp.ges or @tstamp.real">Must have one of the attributes: startid, tstamp, tstamp.ges or tstamp.real.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-dynam_start-type_attributes_required-161">
      <rule context="mei:dynam">
         <assert test="@startid or @tstamp or @tstamp.ges or @tstamp.real"> Must have one of the attributes: startid, tstamp, tstamp.ges or tstamp.real.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-dynam_end-type_attributes-162">
      <rule context="mei:dynam[@val2]">
         <assert test="@dur or @dur.ges or @endid or @tstamp2">When @val2 is present, either @dur, @dur.ges, @endid, or @tstamp2 must also be present.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-extdata-values-163">
      <rule context="mei:when/mei:extData[@type = 'velocity' or @type = 'pitch' or @type = 'writtenPitch']">
         <assert test="matches(normalize-space(.), '^(1[01][0-9]|12[0-7]|[0-9]{1,2})$')">A velocity or a pitch is a whole number from 0 to 127.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-extdata-values-164">
      <rule context="mei:when/mei:extData[@type = 'duration']">
         <assert test="matches(normalize-space(.), '^[0-9]+ms$')">A duration is written in whole milliseconds with the 'ms' unit, for the reason given for @absolute.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-extdata-values-165">
      <rule context="mei:when/mei:extData[@type = 'onsetTicks' or @type = 'durationTicks' or @type = 'ornamentSlot']">
         <assert test="matches(normalize-space(.), '^[0-9]+$')">A tick count and an ornament slot are whole numbers.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-extdata-values-166">
      <rule context="mei:when/mei:extData[@type = 'confidence' or @type = 'ornamentAnchorConfidence']">
         <assert test="matches(normalize-space(.), '^(0(\.[0-9]+)?|1(\.0+)?)$')">A confidence is a number from 0 to 1.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-extdata-values-167">
      <rule context="mei:when/mei:extData[@type = 'ornamentAnchor']">
         <assert test="starts-with(normalize-space(.), '#') and //*[@xml:id = substring-after(normalize-space(current()), '#')]">An ornamentAnchor is a reference of the form '#id' resolving to an element of this document.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-extdata-values-168">
      <rule context="mei:when/mei:extData[@type = 'ornamentAnchorFrom']">
         <assert test="normalize-space(.) = ('model', 'model-and-sign', 'timing')">An ornamentAnchorFrom says whether the model named the anchor ('model'), whether an ornament sign in the score settled a ranking the model was unsure of ('model-and-sign'), or whether it was guessed from the timing ('timing').</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_grpSym_attributes_scoreDef-169">
      <rule context="mei:grpSym[parent::mei:scoreDef]">
         <assert test="@startid and @endid and @level">In scoreDef, grpSym must have startid, endid, and level attributes.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_grpSym_attributes_staffDef-170">
      <rule context="mei:grpSym[parent::mei:staffGrp]">
         <assert test="not(@startid or @endid or @level)">In staffGrp, grpSym must not have startid, endid, or level attributes.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-Check_keyAccidPlacement-171">
      <rule context="mei:keyAccid">
         <assert test="(@x and @y) or @pname or @loc">One of the following is required: @x and @y attribute pair, @pname attribute, or @loc attribute.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_keyAccid_oct-172">
      <rule context="mei:keySig[mei:keyAccid[@oct]]">
         <assert test="count(mei:keyAccid[@oct]) = count(mei:keyAccid)">If the @oct attribute appears on any keyAccid element, it must be provided on all keyAccid elements.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_keySig_editorial-173">
      <rule context="mei:keySig/mei:*[local-name() eq 'add' or local-name() eq 'corr'             or local-name() eq 'damage' or local-name() eq 'del' or local-name() eq 'orig' or              local-name() eq 'reg' or local-name() eq 'restore' or local-name() eq 'sic' or              local-name() eq 'supplied' or local-name() eq 'unclear']">
         <assert test="count(mei:keyAccid) = count(mei:*)">Only keyAccid elements are allowed here.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-Check_staff-174">
      <rule context="mei:*[@staff]">
         <assert test="every $i in tokenize(normalize-space(@staff), '\s+') satisfies $i=//mei:staffDef/@n">The values in @staff must correspond to @n attribute of a staffDef element.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-music-carries-a-performance-175">
      <rule context="mei:music">
         <assert test="mei:performance/mei:recording">An as-played-by document records at least one performance, so its music holds a performance with a recording in it.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-nameParts-176">
      <rule context="mei:name">
         <assert role="warning" test="not(mei:geogName or mei:persName or mei:corpName)">Recommended practice is to use name elements to capture sub-parts of a generic name.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-ornam_start-type_attributes_required-177">
      <rule context="mei:ornam">
         <assert test="@startid or @tstamp or @tstamp.ges or @tstamp.real">Must have one of the attributes: startid, tstamp, tstamp.ges or tstamp.real.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-phrase_start-_and_end-type_attributes_required-178">
      <rule context="mei:phrase">
         <assert test="@startid or @tstamp or @tstamp.ges or @tstamp.real">Must have one of the attributes: startid, tstamp, tstamp.ges or tstamp.real.</assert>
         <assert test="@dur or @dur.ges or @endid or @tstamp2">Must have one of the attributes: dur, dur.ges, endid, or tstamp2.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-phrase_containing_curve-179">
      <rule context="mei:phrase[mei:curve[@bezier or @bulge or @curvedir or @lform or @lwidth or @ho or              @startho or @endho or @to or @startto or @endto or @vo or @startvo or @endvo or @x or @y or @x2 or @y2]]">
         <assert test="not(@bezier or @bulge or @curvedir or @lform or @lwidth or @ho or @startho or @endho or                @to or @startto or @endto or @vo or @startvo or @endvo or @x or @y or @x2 or @y2)"
                  role="warning">The visual attributes of the phrase (@bezier, @bulge, @curvedir, @lform, @lwidth, @ho, @startho, @endho, @to, @startto, @endto, @vo, @startvo, @endvo, @x, @y, @x2, and @y2) will be overridden by visual attributes of the contained curve elements.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-FRBR_relation-180">
      <rule context="mei:relationList/mei:relation[parent::mei:work or parent::mei:expression or           parent::mei:source or parent::mei:item]">
         <assert test="matches(@rel, 'hasAbridgement') or             matches(@rel, 'hasAbridgement') or             matches(@rel, 'isAbridgementOf') or             matches(@rel, 'hasAdaptation') or             matches(@rel, 'isAdaptationOf') or             matches(@rel, 'hasAlternate') or             matches(@rel, 'isAlternateOf') or             matches(@rel, 'hasArrangement') or             matches(@rel, 'isArrangementOf') or             matches(@rel, 'hasComplement') or             matches(@rel, 'isComplementOf') or             matches(@rel, 'hasEmbodiment') or             matches(@rel, 'isEmbodimentOf') or             matches(@rel, 'hasExemplar') or             matches(@rel, 'isExemplarOf') or             matches(@rel, 'hasImitation') or             matches(@rel, 'isImitationOf') or             matches(@rel, 'hasPart') or             matches(@rel, 'isPartOf') or             matches(@rel, 'hasRealization') or             matches(@rel, 'isRealizationOf') or             matches(@rel, 'hasReconfiguration') or             matches(@rel, 'isReconfigurationOf') or             matches(@rel, 'hasReproduction') or             matches(@rel, 'isReproductionOf') or             matches(@rel, 'hasRevision') or             matches(@rel, 'isRevisionOf') or             matches(@rel, 'hasSuccessor') or             matches(@rel, 'isSuccessorOf') or             matches(@rel, 'hasSummarization') or             matches(@rel, 'isSummarizationOf') or             matches(@rel, 'hasSupplement') or             matches(@rel, 'isSupplementOf') or             matches(@rel, 'hasTransformation') or             matches(@rel, 'isTransformationOf') or             matches(@rel, 'hasTranslation') or             matches(@rel, 'isTranslationOf')">Within work, expression, source, or item, the value of the rel attribute must match one of the following: hasAbridgement, isAbridgementOf, hasAdaptation, isAdaptationOf, hasAlternate, isAlternateOf, hasArrangement, isArrangementOf, hasComplement, isComplementOf, hasEmbodiment, isEmbodimentOf, hasExemplar, isExemplarOf, hasImitation, isImitationOf, hasPart, isPartOf, hasRealization, isRealizationOf, hasReconfiguration, isReconfigurationOf, hasReproduction, isReproductionOf, hasRevision, isRevisionOf, hasSuccessor, isSuccessorOf, hasSummarization, isSummarizationOf, hasSupplement, isSupplementOf, hasTransformation, isTransformationOf, hasTranslation, isTranslationOf</assert>
         <assert test="@target">Within work, expression, source or item, the target attribute must be present.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_respStmt-181">
      <rule context="mei:respStmt[not(ancestor::mei:change)]">
         <assert test="(mei:resp and (mei:name or mei:corpName or mei:persName)) or             count(mei:*[@role]) = count(mei:*) and count(mei:*) &gt; 0"
                  role="warning">At least one element pair (a resp element and a name-like element) is recommended. Alternatively, each name-like element may have a @role attribute.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-Check_restline-182">
      <rule context="mei:rest[@line]">
         <let name="thisstaff" value="ancestor::mei:staff/@n"/>
         <assert test="number(@line) &lt;= number(preceding::mei:staffDef[@n=$thisstaff and @lines][1]/@lines)">The value of @line must be less than or equal to the number of lines on the staff.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-Check_sectionexpansion-183">
      <rule context="mei:section[mei:expansion]">
         <assert test="descendant::mei:section|descendant::mei:ending|descendant::mei:rdg">A section containing an expansion element must have descendant section, ending, or rdg elements.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-checkStaff_n-184">
      <rule context="mei:staff[@n]">
         <let name="thisstaff" value="@n"/>
         <assert test="preceding::mei:staffDef[@n=$thisstaff] or preceding::mei:staff[@n=$thisstaff]/mei:staffDef or mei:staffDef">There must be a preceding staffDef with a matching value of @n, a preceding staff with a matching @n value containing a staffDef, or a staffDef child element.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-Check_staffDefn-185">
      <rule context="mei:staffDef[not(ancestor::mei:staff)]">
         <let name="thisstaff" value="@n"/>
         <assert test="@n">StaffDef must have an n attribute.</assert>
         <assert test="@lines or preceding::mei:staffDef[@n=$thisstaff and @lines]"> Either @lines must be present or a preceding staffDef with the same value for @n and @lines must exist.</assert>
         <assert test="count(mei:clef) + count(mei:clefGrp) &lt; 2">Only one clef or clefGrp is permitted.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-Check_ancestor_staff-186">
      <rule context="mei:staffDef[ancestor::mei:staff and @n]">
         <let name="thisstaff" value="@n"/>
         <assert test="ancestor::mei:staff/@n eq $thisstaff">@n must have the same value as the current staff.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-Check_ancestor_staff_lines-187">
      <rule context="mei:staffDef[ancestor::mei:staff and not(@n)]">
         <let name="thisstaff" value="ancestor::mei:staff/@n"/>
         <assert test="@lines or preceding::mei:staffDef[@n=$thisstaff and @lines]"> Either @lines must be present or a preceding staffDef with matching @n value and @lines must exist.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-Check_clef_position_staffDef-188">
      <rule context="mei:staffDef[@clef.line and @lines]">
         <assert test="number(@clef.line) &lt;= number(@lines)">The clef position must be less than or equal to the number of lines on the staff.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-Check_clef_position_staffDef_nolines-189">
      <rule context="mei:staffDef[@clef.line and not(@lines)]">
         <let name="thisstaff" value="@n"/>
         <let name="stafflines"
               value="preceding::mei:staffDef[@n=$thisstaff and @lines][1]/@lines"/>
         <assert test="number(@clef.line) &lt;= number($stafflines)">The clef position must be less than or equal to the number of lines on the staff.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-Check_tab_strings_lines-190">
      <rule context="mei:staffDef[@tab.strings and @lines]">
         <let name="countTokens"
               value="count(tokenize(normalize-space(@tab.strings), '\s'))"/>
         <assert test="$countTokens = @lines">The tab.strings attribute must have the same number of values as there are staff lines.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-Check_tab_strings_nolines-191">
      <rule context="mei:staffDef[@tab.strings and not(@lines)]">
         <let name="countTokens"
               value="count(tokenize(normalize-space(@tab.strings), '\s'))"/>
         <let name="thisstaff" value="@n"/>
         <assert test="$countTokens = preceding::mei:staffDef[@n=$thisstaff and @lines][1]/@lines">The tab.strings attribute must have the same number of values as there are staff lines.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-Check_lines_color-3">
      <rule context="mei:staffDef[@lines.color and @lines]">
         <let name="countTokens"
               value="count(tokenize(normalize-space(@lines.color), '\s'))"/>
         <assert test="$countTokens = 1 or $countTokens = @lines">The lines.color attribute must have either 1) a single value or 2) the same number of values as there are staff lines.</assert>
      </rule>
      <rule context="mei:staffDef[@lines.color and not(@lines)]">
         <let name="countTokens"
               value="count(tokenize(normalize-space(@lines.color), '\s'))"/>
         <let name="thisstaff" value="@n"/>
         <assert test="$countTokens = 1 or $countTokens = preceding::mei:staffDef[@n=$thisstaff and @lines][1]/@lines">The lines.color attribute must have either 1) a single value or 2) the same number of values as there are staff lines.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-Check_staff_ppq_ancestor-4">
      <rule context="mei:staffDef[@ppq][ancestor::mei:scoreDef[@ppq]]">
         <let name="staffPPQ" value="@ppq"/>
         <let name="scorePPQ" value="ancestor::mei:scoreDef[@ppq][1]/@ppq"/>
         <assert test="($scorePPQ mod $staffPPQ) = 0">The value of ppq must be a factor of the value of ppq on an ancestor scoreDef.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-Check_staff_ppq_preceding-5">
      <rule context="mei:staffDef[@ppq][preceding::mei:scoreDef[@ppq]]">
         <let name="staffPPQ" value="@ppq"/>
         <let name="scorePPQ" value="preceding::mei:scoreDef[@ppq][1]/@ppq"/>
         <assert test="($scorePPQ mod $staffPPQ) = 0">The value of ppq must be a factor of the value of ppq on a preceding scoreDef.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-Check_staffGrp_unique_staff_n_values-196">
      <rule context="mei:staffGrp">
         <let name="countstaves" value="count(descendant::mei:staffDef)"/>
         <let name="countuniqstaves"
               value="count(distinct-values(descendant::mei:staffDef/@n))"/>
         <assert test="$countstaves eq $countuniqstaves">Each staffDef must have a unique value for the n attribute.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-symbolDef_symbol_attributes_required-197">
      <rule context="mei:symbol[ancestor::mei:symbolDef]">
         <assert test="@startid or (@x and @y)">In the symbolDef context, symbol must have either a startid attribute or x and y attributes.</assert>
         <assert test="@altsym or @glyph.name or @glyph.num">In the symbolDef context, symbol must have one of the following attributes: altsym, glyph.name, or glyph.num.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-tempo_in_header_disallow_most_attrs-198">
      <rule context="mei:tempo[not(ancestor::mei:score or ancestor::mei:part)]">
         <assert test="not(@*[name() != 'analog' and name() != 'class' and name() != 'label' and name() != 'mm' and name() != 'mm.dots' and name() != 'translit' and name() != 'type' and name() != 'mm.unit' and name() != 'n' and name() != 'xml:base' and name() != 'xml:id' and name() != 'xml:lang'])">Only analog, class, label, mm, mm.dots, mm.unit, n, translit, type, xml:base, xml:id, and xml:lang attributes are allowed when tempo is not a descendant of a score or part.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-tempo_start-type_attributes_required-199">
      <rule context="mei:tempo[not(ancestor::mei:syllable) and not(ancestor::mei:work) and not(ancestor::mei:expression) and not(count(ancestor::mei:*) = 0)]">
         <assert test="@startid or @tstamp or @tstamp.ges or @tstamp.real">Must have one of the attributes: startid, tstamp, tstamp.ges or tstamp.real.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-Check_term_dataTarget-200">
      <rule context="mei:term[@data]">
         <assert test="ancestor::mei:classification">The @data attribute may only occur on a term which is a descendant of a classification element.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-list_type_constraint-201">
      <rule context="mei:list[contains(@type,'gloss')]">
         <assert test="count(mei:label) = count(mei:li)">In a list of type "gloss" all items must be immediately preceded by a label.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_altsymTarget-202">
      <rule context="@altsym">
         <assert role="warning" test="not(normalize-space(.) eq '')">@altsym attribute should have content.</assert>
         <assert role="warning"
                  test="every $i in tokenize(., '\s+') satisfies substring($i,2)=//mei:symbolDef/@xml:id">The value in @altsym should correspond to the @xml:id attribute of a symbolDef element.</assert>
         <assert test="not(substring(., 2) eq ancestor::mei:symbolDef/@xml:id)">The value in @altsym must not correspond to the @xml:id attribute of a symbolDef ancestor.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-symbolDef_curve_attributes_required-203">
      <rule context="mei:curve[ancestor::mei:symbolDef]">
         <assert test="@startid or (@x and @y)">In the symbolDef context, curve must have either a startid attribute or x and y attributes.</assert>
         <assert test="@endid or (@x2 and @y2)">In the symbolDef context, curve must have either an endid attribute or both x2 and y2 attributes.</assert>
         <assert test="@bezier or @bulge">In the symbolDef context, curve must have either a bezier or bulge attribute.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-line_start-_and_end-type_attributes_required-204">
      <rule context="mei:line[ancestor::mei:symbolDef]">
         <assert test="@startid or (@x and @y)">When used in the symbolDef context, must have either a startid attribute or x and y attributes.</assert>
         <assert test="@endid or (@x2 and @y2)">When used in the symbolDef context, must have either an endid attribute or both x2 and y2 attributes.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-line_start-_and_end-type_attributes_required-205">
      <rule context="mei:line[not(ancestor::mei:symbolDef)]">
         <assert test="@startid or @tstamp or @tstamp.ges or @tstamp.real or (@x and @y)">When used in the score context, must have a startid, tstamp, tstamp.ges or tstamp.real attribute or both x and y attributes.</assert>
         <assert test="@dur or @dur.ges or @endid or @tstamp2 or (@x2 and @y2)">When used in the score context, must have an endid, dur, dur.ges, or tstamp2 attribute or both x2 and y2 attributes.</assert>
      </rule>
   </pattern>
   <pattern id="schematron-constraint-check_beams.floating-206">
      <rule context="mei:fTrem[@beams and @beams.float]">
         <assert test="@beams.float &lt;= @beams">The number of floating beams must be less than or equal to the total number of beams.</assert>
      </rule>
   </pattern>
</schema>
