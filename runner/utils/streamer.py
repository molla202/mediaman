# coding: utf-8
import dateparser


def is_slot_in_playlist(new_slot, slots):
    for slot in slots:
        start = dateparser.parse(slot['startAt'])
        end = dateparser.parse(slot['endAt'])
        new_slot_start = dateparser.parse(new_slot['startAt'])
        new_slot_end = dateparser.parse(new_slot['endAt'])
        if start.time() == new_slot_start.time() and new_slot_end.time() == end.time():
            return slots.index(slot)
    return -1
