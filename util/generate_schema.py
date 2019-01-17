from bs4 import BeautifulSoup
import html2text

with open('audio_analysis.html', 'rb') as f:
    soup = BeautifulSoup(f.read().decode('utf-8'), 'html.parser')


h = html2text.HTML2Text()
h.body_width = 0

names_map = {
    'album-object-full': 'Album',
    'album-object-simplified': 'SimplifiedAlbum',
    'artist-object-full': 'Artist',
    'artist-object-simplified': 'SimplifiedArtist',
    'audio-features-object': 'AudioFeatures',
    'category-object': 'Category',
    'context-object': 'Context',
    'copyright-object': 'Copyright',
    'cursor-object': 'Cursor',
    'error-object': 'Error',
    'player-error-object': 'PlayerError',
    # 'player-error-reasons': 'PlayerErrorReasons',
    'external-id-object': 'ExternalId',
    'external-url-object': 'ExternalUrl',
    'followers-object': 'Followers',
    'image-object': 'Image',
    'paging-object': 'Paging',
    'cursor-based-paging-object': 'CursorPaging',
    'play-history-object': 'PlayHistory',
    'playlist-object-full': 'Playlist',
    'playlist-object-simplified': 'SimplifiedPlaylist',
    'playlist-track-object': 'PlaylistTrack',
    'recommendations-object': 'RecommendationsResponse',
    'recommendations-seed-object': 'RecommendationsSeed',
    'saved-track-object': 'SavedTrack',
    'saved-album-object': 'SavedAlbum',
    'track-object-full': 'Track',
    'track-object-simplified': 'SimplifiedTrack',
    'track-link': 'TrackLink',
    'user-object-private': 'PrivateUser',
    'user-object-public': 'PublicUser',

    'timestamps': 'String',

    'audio-analysis-object': 'AudioAnalysis',
    'time-interval-object': 'TimeInterval',
    'section-object': 'Section',
    'segment-object': 'Segment',
}


objects = []


for obj in soup.find_all('h3'):
    if obj.get('id') not in names_map:
        print('Skipping', obj.get('id'))
        continue

    objects.append([])

    name = names_map[obj.get('id')]
    table = obj.findNext('table').find('tbody')

    objects[-1].append('type ' + name)
    objects[-1].append(' {\n')
    
    fields = []

    for tr in table.find_all('tr'):
        fields.append([])
        columns = tr.find_all('td')

        fields[-1].append('  """\n')
        fields[-1].append('  ' + h.handle(columns[2].decode_contents()).strip() + '\n')
        fields[-1].append('  """\n')

        fields[-1].append('  ' + columns[0].text.replace('{', '').replace('}', '') + ': ')

        if 'array' in columns[1].text:
            link = columns[1].find('a')

            if link:
                fields[-1].append('[' + names_map[link.get('href').split('#')[1]] + '!]')
            elif 'string' in columns[1].text:
                fields[-1].append('[String!]')
            elif 'float' in columns[1].text:
                fields[-1].append('[Float!]')
            elif columns[2].find('a'):
                fields[-1].append('[' + names_map[columns[2].find('a').get('href').split('#')[1]] + '!]')
            else:
                fields[-1].append('[UNKNOWN!]')
        elif 'string' in columns[1].text.lower():
            fields[-1].append('String')
        elif 'int' in columns[1].text.lower():
            fields[-1].append('Int')
        elif 'float' in columns[1].text.lower():
            fields[-1].append('Float')
        elif 'boolean' in columns[1].text.lower():
            fields[-1].append('Boolean')
        elif columns[1].find('a'):
            fields[-1].append(names_map[columns[1].find('a').get('href').split('#')[1]])
        elif 'restrictions' in columns[1].text.lower():
            fields[-1].append('Restrictions')
        elif 'object' in columns[1].text.lower():
            fields[-1].append('Object')
        else:
            raise Exception(columns[1].text)

        if 'null' not in columns[2].text and 'optional' not in columns[1].text:
            fields[-1].append('!')

        fields[-1] = ''.join(fields[-1])

    objects[-1].append('\n\n'.join(fields))
    objects[-1].append('\n}')
    objects[-1] = ''.join(objects[-1])


with open('schema.txt', 'wb') as f:
    f.write('\n\n'.join(objects).encode())


