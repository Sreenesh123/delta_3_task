import React, {
  useState,
  useEffect,
  useContext,
  useRef,
  useCallback,
} from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { PlayerContext } from "../context/PlayerContext";
import { setClientToken } from "../spotify";
import { useNavigate } from "react-router-dom";
import { FaHeart, FaPlay, FaRandom } from "react-icons/fa";
import SearchSongs from "./SearchSongs";

const ListPlaylist = () => {
  const {
    setselectedTrackData,
    setSelectedTrack,
    setLiked,
    embedController,
    likedSongs,
    setLikedSongs,
    setSongsData,
    songsData,
    time,
    Track,
    setTrack,
    playWithId,
    playlistimage,
    setPlaylistImage,playMode,setPlayMode
  } = useContext(PlayerContext);

  const [email, setEmail] = useState(localStorage.getItem("email") || "");
  const [data, setData] = useState([]);
  const [userlikedsongs, setLikedsongs] = useState([]);
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [showLikedSongs, setShowLikedSongs] = useState(false);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  

  const lastProcessedTimeRef = useRef({ minute: 0, second: 0 });
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      console.log("Retrieved token:", token);
      setClientToken(token);
      setIsAuthenticated(true);
    } else {
      console.error("No token found.");
      setIsAuthenticated(false);
    }
  }, []);

  const stopCurrentPlayback = useCallback(async () => {
    if (embedController) {
      await embedController.pause();
    }
    setTrack(null);
    setSelectedTrack(null);
    setselectedTrackData(null);
  }, [embedController, setTrack, setSelectedTrack, setselectedTrackData]);

  const playdjsongs = useCallback(
    async (playlist) => {
      if (playMode !== "dj") {
        await stopCurrentPlayback();
        setPlayMode("dj");
      }

      const tracks = playlist.tracks;
      setSongsData(tracks);

      if (tracks.length > 0) {
        setselectedTrackData(tracks[0]);
        setCurrentSongIndex(0);
        console.log(tracks[0]);
        await playWithId(tracks[0]._id, tracks);
      } else {
        console.log("No tracks in the playlist");
      }
    },
    [
      setSongsData,
      setselectedTrackData,
      setCurrentSongIndex,
      playWithId,
      playMode,
      stopCurrentPlayback,
    ]
  );

  const playTrack = useCallback(
    async (songs, song) => {
      console.log("Entered playTrack with song:", song);
      setTrack(song);

      const isLiked = likedSongs.some(
        (track) =>
          (track.uri ? track.uri : "") === (song.uri ? song.uri : "none")
      );
      setLiked(isLiked);
      console.log("Track selected, isLiked:", isLiked);
      console.log(song);

      setSelectedTrack(song);
      setselectedTrackData({
        ...song,
        isLiked: isLiked,
      });

      if (embedController) {
        console.log("Loading URI in embed controller:", song.uri);
        await embedController.loadUri(song.uri);
        console.log("URI loaded, attempting to play");
        await embedController.play();
      }

      return new Promise((resolve) => {
        if (embedController) {
          embedController.addListener("playback_update", (e) => {
            console.log("Playback update:", e.data.position, e.data.duration);
            if (e.data.position >= e.data.duration) {
              console.log("Song finished, resolving promise");
              resolve();
            }
          });
        } else {
          resolve();
        }
      });
    },
    [
      setTrack,
      likedSongs,
      setLiked,
      setSelectedTrack,
      setselectedTrackData,
      embedController,
    ]
  );

  const playSequentially = useCallback(
    async (songs, startIndex = 0) => {
      if (playMode !== "playall") {
        await stopCurrentPlayback();
        setPlayMode("playall");
      }

      setSongsData(songs);
      console.log("Starting playback with songs:", songs);

      if (startIndex >= songs.length) {
        console.log("Reached end of playlist");
        return;
      }

      const song = songs[startIndex];
      console.log(`Playing song at index ${startIndex}:`, song);

      try {
        await playTrack(songs, song);
        setCurrentSongIndex(startIndex);
      } catch (error) {
        console.error("Error playing track:", error);
      }
    },
    [
      setSongsData,
      playTrack,
      setCurrentSongIndex,
      playMode,
      stopCurrentPlayback,
    ]
  );

  useEffect(() => {
    const reqtime = time;
    const currentTotalSeconds =
      reqtime.currentTime.minute * 60 + reqtime.currentTime.second;
    const totalSeconds =
      reqtime.totalTime.minute * 60 + reqtime.totalTime.second;
    const lastProcessedTotalSeconds =
      lastProcessedTimeRef.current.minute * 60 +
      lastProcessedTimeRef.current.second;

    if (
      currentTotalSeconds >= totalSeconds &&
      currentTotalSeconds > 0 &&
      totalSeconds > 0 &&
      currentTotalSeconds !== lastProcessedTotalSeconds
    ) {
      console.log("Song finished, moving to next");
      lastProcessedTimeRef.current = reqtime.currentTime;
      playSequentially(songsData, currentSongIndex + 1);
    }
  }, [time, songsData, currentSongIndex, playSequentially]);

  const fetchPlaylists = async () => {
    try {
      const response = await axios.get(
        `http://localhost:3000/api/playlist/list/${email}`
      );
      if (response.data.success) {
        setData(response.data.playlists);
      }
    } catch (error) {
      toast.error("Error occurred while fetching playlists.");
      console.error(error.message);
    }
  };

  const fetchLikedSongs = async () => {
    try {
      const response = await axios.get(
        `http://localhost:3000/api/like/list/${email}`
      );
      if (response.data.success) {
        setLikedsongs(response.data.likedSongs);
      }
    } catch (error) {
      toast.error("Error occurred while fetching liked songs.");
      console.error(error.message);
    }
  };

  useEffect(() => {
    fetchPlaylists();
    fetchLikedSongs();
  }, [email]);

  const handlePlaylistClick = useCallback(
    (playlistId, playlistname, playlistimage) => {
      setPlaylistImage(playlistimage);
      navigate(`/playlist/display/${playlistId}/${playlistname}`);
    },
    [setPlaylistImage, navigate]
  );

  const handleLikedSongsClick = useCallback(() => {
    setShowLikedSongs(true);
  }, []);

  if (isAuthenticated === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="w-16 h-16 border-4 border-gray-400 border-t-green-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
        <p className="text-lg mb-4">Please log in to access this page.</p>
        <button
          onClick={() => navigate("/login")}
          className="bg-yellow-500 text-gray-900 px-6 py-2 rounded-full hover:bg-yellow-400 transition"
        >
          Login
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gradient-to-b from-gray-900 to-black text-white min-h-screen">
      <div className="invisible">
        <SearchSongs />
      </div>
      <h1 className="text-3xl font-bold mb-6">
        {showLikedSongs ? "Liked Songs" : "Your Playlists"}
      </h1>
      {!showLikedSongs ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <div
            className="relative bg-gradient-to-br from-purple-700 to-blue-500 text-white p-4 rounded-lg shadow-lg cursor-pointer group"
            onClick={handleLikedSongsClick}
          >
            <div className="h-40 flex items-center justify-center mb-4">
              <FaHeart className="text-6xl" />
            </div>
            <p className="text-lg font-semibold">Liked Songs</p>
            <div className="absolute bottom-4 right-4 bg-green-500 rounded-full p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <FaPlay className="text-white" />
            </div>
          </div>
          {data.map((item) => (
            <div
              key={item._id}
              className="relative bg-gray-800 hover:bg-gray-700 text-white p-4 rounded-lg shadow-lg cursor-pointer group"
              onClick={() =>
                handlePlaylistClick(item._id, item.name, item.image)
              }
            >
              <img
                className="w-full h-40 object-cover rounded-lg mb-4"
                src={item.image}
                alt={item.name}
              />
              <p className="text-lg font-semibold truncate">{item.name}</p>
              <p className="text-sm text-gray-400 mt-1">
                {item.tracks.length} tracks
              </p>
              <div className="absolute bottom-4 right-4 bg-green-500 rounded-full p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <FaPlay className="text-white" />
              </div>
              <div className="absolute top-2 right-2 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    playdjsongs(item);
                  }}
                  className={`bg-black bg-opacity-50 p-2 rounded-full hover:bg-opacity-75 transition-all duration-300 ${
                    playMode === "dj" ? "ring-2 ring-green-500" : ""
                  }`}
                >
                  <FaRandom className="text-white" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    playSequentially(item.tracks);
                  }}
                  className={`bg-black bg-opacity-50 p-2 rounded-full hover:bg-opacity-75 transition-all duration-300 ${
                    playMode === "playall" ? "ring-2 ring-green-500" : ""
                  }`}
                >
                  <FaPlay className="text-white" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div>
          {userlikedsongs.map((song, index) => (
            <div
              key={index}
              onClick={() => playTrack([song], song)}
              className="bg-gray-800 text-white p-3 rounded-lg mb-4 flex items-center cursor-pointer hover:bg-gray-700 transition-transform transform hover:-translate-y-1"
            >
              <img
                src={song.image.url}
                alt={song.name}
                className="w-12 h-12 object-cover rounded mr-3"
              />
              <div>
                <p className="text-lg font-semibold">{song.name}</p>
                <p className="text-sm">{song.artist}</p>
              </div>
              <FaHeart className="ml-auto text-red-500" />
            </div>
          ))}
          <button
            onClick={() => setShowLikedSongs(false)}
            className="bg-yellow-500 text-black px-4 py-2 rounded-full mt-4 hover:bg-yellow-400 transition"
          >
            Back to Playlists
          </button>
        </div>
      )}
      <div id="embed-iframe" className="w-0 h-0 invisible hidden"></div>
    </div>
  );
};

export default ListPlaylist;
