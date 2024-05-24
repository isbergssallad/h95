const container = document.getElementById("all-films");


document.addEventListener("DOMContentLoaded", () => {
    //Fetch request till /movies
    fetch("http://localhost:4000/movies")
        .then(res => res.json())
        .then(data => {
            //Loopar över alla filmer
            data.movies.forEach(film => {
                //Skapa poster och länk för att gå vidare
                const link = document.createElement("a");
                link.href = "/film?film_id=" + film.filmID;

                const image = document.createElement("img");
                image.src = film.poster;
                
                link.appendChild(image);
                container.appendChild(link);
            });

        })
        .catch(error => {
            console.error("Error fetching movie:", error);
        });
});