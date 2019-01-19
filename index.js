const {ApolloServer, gql} = require('apollo-server');
const fetch = require('node-fetch');
const {URLSearchParams} = require('url');
const fs = require('fs');
const path = require('path');
const DataLoader = require('dataloader');

const CLIENT_ID = process.env.CLIENT_ID || '';
const CLIENT_SECRET = process.env.CLIENT_SECRET || '';

const BASE_URL = 'https://api.spotify.com/v1';
const PORT = process.env.PORT || 4000;

const typeDefs = fs.readFileSync(path.join(__dirname, 'schema.graphql'), 'utf8');

let token;

async function authorize(clientId, clientSecret) {
  // Make a request to fetch the token.
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    body: 'grant_type=client_credentials',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });

  // Wait for the JSON response.
  const json = await response.json();

  // Get the access token.
  return json['access_token'];
}

async function get(suffix, params, retry = true) {
  const searchParams = new URLSearchParams();

  Object.entries(params)
    .filter(entry => entry[1] !== null && entry[1] !== undefined)
    .forEach(entry => searchParams.append(entry[0], entry[1]));

  const paramsString = searchParams.toString();
  const url = BASE_URL + suffix + ((paramsString.length) ? '?' + paramsString : '');

  return fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + token
    }
  }).then(async response => {
    if (response.status === 401 && retry) {
      token = await authorize(CLIENT_ID, CLIENT_SECRET);
      return await get(suffix, params, false);
    }

    const json = await response.json();

    if (!response.ok) {
      throw new Error(json.error.message);
    }

    return json;
  });
}

function createEdge(obj) {
  return {
    items: obj.items,
    paging: obj,
  }
}

function objToList(obj) {
  const list = [];

  Object.entries(obj).forEach(entry => list.push({
    key: entry[0],
    value: entry[1]
  }));

  return list;
}

const resolvers = {
  Query: {
    async album(parent, args, context, info) {
      const {id, ...params} = args;
      return get(`/albums/${id}`, params);
    },

    async albums(parent, args, context, info) {
      const params = {...args};
      params.ids = params.ids.join(',');
      return get(`/albums`, params).then(obj => obj.albums);
    },

    async artist(parent, args, context, info) {
      const id = args.id;
      return get(`/artists/${id}`, {});
    },

    async artists(parent, args, context, info) {
      const params = {...args};
      params.ids = params.ids.join(',');
      return get(`/artists`, params).then(obj => obj.artists);
    },

    async tracks(parent, args, context, info) {
      const params = {...args};
      params.ids = params.ids.join(',');
      return get(`/tracks`, params).then(obj => obj.tracks);
    },

    async track(parent, args, context, info) {
      const {id, ...params} = args;
      return get(`/tracks/${id}`, params);
    },

    async search(parent, args, context, info) {
      const params = {...args};
      return get(`/search`, params).then(obj => {
        Object.entries(obj).forEach(entry => obj[entry[0]] = createEdge(entry[1]));
        return obj;
      });
    },

    async playlist(parent, args, context, info) {
      const {id, ...params} = args;
      return get(`/playlists/${id}`, params);
    },

    async user(parent, args, context, info) {
      const id = args.id;
      return get(`/users/${id}`, {});
    },

    async category(parent, args, context, info) {
      const {id, ...params} = args;
      return get(`/browse/categories/${id}`, {});
    },

    async categories(parent, args, context, info) {
      const params = {...args};
      return get(`/browse/categories`, params).then(obj => createEdge(obj.categories));
    },

    async featured_playlists(parent, args, context, info) {
      const params = {...args};
      return get(`/browse/featured-playlists`, params).then(obj => createEdge(obj.playlists));
    },

    async new_releases(parent, args, context, info) {
      const params = {...args};
      return get(`/browse/new-releases`, params).then(obj => createEdge(obj.albums));
    },
  },

  Album: {
    async tracks(parent, args, context, info) {
      if (Object.keys(args).length === 0) {
        return parent.tracks;
      }

      const params = {...args};
      return get(`/albums/${parent.id}/tracks`, params).then(createEdge);
    },

    async external_ids(parent, args, context, info) {
      return objToList(parent.external_ids);
    },

    async external_urls(parent, args, context, info) {
      return objToList(parent.external_urls);
    },
  },

  SimplifiedAlbum: {
    async external_urls(parent, args, context, info) {
      return objToList(parent.external_urls);
    },
  },

  Artist: {
    async albums(parent, args, context, info) {
      const params = {...args};
      return get(`/artists/${parent.id}/albums`, params).then(createEdge);
    },

    async top_tracks(parent, args, context, info) {
      const params = {...args};
      return get(`/artists/${parent.id}/top-tracks`, params).then(obj => obj.tracks);
    },

    async related_artists(parent, args, context, info) {
      return get(`/artists/${parent.id}/related-artists`, {}).then(obj => obj.artists);
    },

    async external_urls(parent, args, context, info) {
      return objToList(parent.external_urls);
    },
  },

  SimplifiedArtist: {
    async external_urls(parent, args, context, info) {
      return objToList(parent.external_urls);
    },
  },

  Category: {
    async playlists(parent, args, context, info) {
      const params = {...args};
      return get(`/browse/categories/${parent.id}/playlists`, params)
        .then(obj => obj.playlists)
        .then(createEdge);
    },
  },

  Context: {
    async external_urls(parent, args, context, info) {
      return objToList(parent.external_urls);
    },
  },

  Playlist: {
    async tracks(parent, args, context, info) {
      if (Object.keys(args).length === 0) {
        return parent.tracks;
      }

      const params = {...args};
      return get(`/playlists/${parent.id}/tracks`, params).then(createEdge);
    },

    async contains_followers(parent, args, context, info) {
      const params = {...args};
      params.ids = params.ids.join(',');
      return get(`/playlists/${parent.id}/followers/contains`, params);
    },

    async external_urls(parent, args, context, info) {
      return objToList(parent.external_urls);
    },
  },

  SimplifiedPlaylist: {
    async external_urls(parent, args, context, info) {
      return objToList(parent.external_urls);
    },
  },

  Track: {
    async audio_analysis(parent, args, context, info) {
      return get(`/audio-analysis/${parent.id}`, {});
    },

    async audio_features(parent, args, context, info) {
      return audioFeatureLoader.load(parent.id);
    },

    async external_ids(parent, args, context, info) {
      return objToList(parent.external_ids);
    },

    async external_urls(parent, args, context, info) {
      return objToList(parent.external_urls);
    },
  },

  SimplifiedTrack: {
    async external_urls(parent, args, context, info) {
      return objToList(parent.external_urls);
    },
  },

  LinkedTrack: {
    async external_urls(parent, args, context, info) {
      return objToList(parent.external_urls);
    },
  },

  PrivateUser: {
    async external_urls(parent, args, context, info) {
      return objToList(parent.external_urls);
    },
  },

  PublicUser: {
    async playlists(parent, args, context, info) {
      const params = {...args};
      return get(`/users/${parent.id}/playlists`, params).then(createEdge);
    },

    async external_urls(parent, args, context, info) {
      return objToList(parent.external_urls);
    },
  },

  PlaylistTrackItem: {
    __resolveType(obj, context, info) {
      if (obj.is_local) {
        return 'LocalPlaylistTrack';
      } else {
        return 'PlaylistTrack';
      }
    }
  },
};

const audioFeatureLoader = new DataLoader(async ids => {
  if (ids.length === 1) {
    return [await get(`/audio-features/${ids[0]}`, {})];
  }

  const objs = await get(`/audio-features`, {
    ids: ids.join(',')
  });

  objs.audio_features.sort((a, b) => {
    return ids.indexOf(a.id) - ids.indexOf(b.id);
  });

  return objs.audio_features;
});

const server = new ApolloServer({
  typeDefs,
  resolvers,
  debug: false,
  introspection: true,
  playground: true,
});

authorize(CLIENT_ID, CLIENT_SECRET).then(data => {
  token = data;

  server.listen({port: PORT}).then(({url}) => {
    console.log(`🚀 Server ready at ${url}!`);
  });
});