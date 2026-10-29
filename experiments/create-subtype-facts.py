"""Archive public subtype names and field-presence facts; no SDK implementation."""
import hashlib
import json
import re
from pathlib import Path

source = Path('node_modules/@grammyjs/types/message.d.ts').read_text()
block = source.split('export declare namespace Message {', 1)[1].split('\n}', 1)[0]
names = re.findall(r'^    (?:interface|type) (\w+)', block, re.M)
service = (
    'message_id message_thread_id from sender_chat date guest_query_id '
    'business_connection_id chat is_topic_message direct_messages_topic'
).split()
common = service + (
    'sender_tag receiver_user ephemeral_message_id sender_boost_count '
    'sender_business_bot forward_origin is_automatic_forward reply_to_message '
    'reply_to_checklist_task_id reply_to_poll_option_id is_paid_post external_reply '
    'quote reply_to_story via_bot guest_bot_caller_user guest_bot_caller_chat '
    'edit_date has_protected_content show_caption_above_media is_from_offline '
    'author_signature link_preview_options effect_id paid_star_count reply_markup'
).split()
captionable = common + ['caption', 'caption_entities']
bases = {
    'ServiceMessage': service,
    'CommonMessage': common,
    'CaptionableMessage': captionable,
    'MediaMessage': captionable + ['media_group_id', 'has_media_spoiler'],
}
media = set('LivePhoto Photo Video'.split())
caption = set('Audio Document Voice'.split())
ordinary = set((
    'Text RichMessage PaidMedia Sticker Story VideoNote Contact Dice Game '
    'Poll Venue Location Checklist'
).split())
aliases = {}
for name in names:
    if name in bases:
        continue
    stem = name.removesuffix('Message')
    field = re.sub(r'(?<!^)(?=[A-Z])', '_', stem).lower()
    base = 'ServiceMessage'
    for group, candidate in [
        (media, 'MediaMessage'),
        (caption, 'CaptionableMessage'),
        (ordinary, 'CommonMessage'),
    ]:
        if stem in group:
            base = candidate
    required = [field]
    optional = []
    if stem == 'Animation':
        base, required = 'CaptionableMessage', ['animation', 'document']
    if stem == 'Venue':
        required += ['location']
    if stem == 'Text':
        optional = ['entities']
    aliases[name] = {'base': base, 'required': required, 'optional': optional}
sdk = json.loads(Path('node_modules/@grammyjs/types/package.json').read_text())
facts = {
    'sdk': '@grammyjs/types@' + sdk['version'],
    'source': 'node_modules/@grammyjs/types/message.d.ts',
    'sha256': hashlib.sha256(source.encode()).hexdigest(),
    'bases': bases,
    'aliases': aliases,
}
target = Path('docs/case-studies/issue-1/data/bot-api/subtype-facts.json')
target.write_text(json.dumps(facts, indent=2) + '\n')
